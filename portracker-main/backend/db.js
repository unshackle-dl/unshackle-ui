// backend/db.js
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

/**
 * Log database INFO message
 * @param {...any} args Arguments to log
 */
function dbLog(...args) {
  console.log("[Database] INFO:", ...args);
}

/**
 * Log database ERROR message
 * @param {...any} args Arguments to log
 */
function dbError(...args) {
  console.error("[Database] ERROR:", ...args);
}

/**
 * Log database WARN message
 * @param {...any} args Arguments to log
 */
function dbWarn(...args) {
  console.warn("[Database] WARN:", ...args);
}

/**
 * Log database DEBUG message (only if appDebugEnabled is true)
 * @param {boolean} appDebugEnabled - Whether application-level debug is enabled.
 * @param {...any} args Arguments to log
 */
function dbDebug(appDebugEnabled, ...args) {
  if (appDebugEnabled) {
    console.log("[Database] DEBUG:", ...args);
  }
}

// Where to store DB: use env if present, else fallback to ./data/ports-tracker.db
const defaultDataDir = path.resolve(process.cwd(), "data");
const defaultDbPath = path.join(defaultDataDir, "ports-tracker.db");
const dbPath = process.env.DATABASE_PATH || defaultDbPath;

// If using the default location, ensure the dir exists
if (!process.env.DATABASE_PATH) {
  fs.mkdirSync(defaultDataDir, { recursive: true });
}
dbLog("Using database at", dbPath);
const db = new Database(dbPath);

// Check if servers table exists
const tableExists = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='servers'"
  )
  .get();

// If not existing, create with all required columns
if (!tableExists) {
  dbLog("Creating new database tables with updated schema");
  db.exec(`
    CREATE TABLE servers (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'peer',
      parentId TEXT,
      platform TEXT DEFAULT 'standard',
      platform_config TEXT,
      platform_type TEXT DEFAULT 'auto',
      unreachable INTEGER DEFAULT 0,
      FOREIGN KEY (parentId) REFERENCES servers(id)
    );
    
    CREATE TABLE IF NOT EXISTS notes (
      server_id     TEXT NOT NULL,
      host_ip       TEXT NOT NULL,
      host_port     INTEGER NOT NULL,
      note          TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (server_id, host_ip, host_port),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
`);
  // createNotesTable.run();

  // Add updated_at to notes table if it doesn't exist
  try {
    const notesColumns = db.prepare("PRAGMA table_info(notes)").all();
    if (!notesColumns.some((col) => col.name === "updated_at")) {
      dbLog('Schema migration: Adding "updated_at" column to "notes" table.');
      db.prepare("ALTER TABLE notes ADD COLUMN updated_at DATETIME").run();
    }
  } catch (err) {
    // This can happen if the table doesn't exist yet on first run, which is fine.
    if (!err.message.includes("no such table: notes")) {
      dbLog("Error during notes table schema check:", err.message);
    }
  }

  const createIgnoresTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS ignores (
    server_id TEXT NOT NULL,
    host_ip TEXT NOT NULL,
    host_port INTEGER NOT NULL,
    PRIMARY KEY (server_id, host_ip, host_port),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );
`);
  createIgnoresTable.run();
} else {
  // Migration logic for existing tables
  try {
    // Add updated_at to notes table if it doesn't exist
    const notesColumns = db.prepare("PRAGMA table_info(notes)").all();
    if (!notesColumns.some((col) => col.name === "updated_at")) {
      dbLog('Schema migration: Adding "updated_at" column to "notes" table.');
      db.prepare("ALTER TABLE notes ADD COLUMN updated_at DATETIME").run();
    }

    const columns = db.prepare("PRAGMA table_info(servers)").all();
    const columnNames = columns.map((col) => col.name);

    if (!columnNames.includes("type")) {
      dbLog(
        "Migrating database: Table needs major restructuring (missing type column)"
      );
      const tempTableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='servers_new'"
        )
        .get();
      if (tempTableExists) {
        dbLog("Dropping existing temporary table servers_new");
        db.exec(`DROP TABLE servers_new;`);
      }
      const existingServers = db.prepare("SELECT * FROM servers").all();
      db.exec(`
        CREATE TABLE servers_new (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          url TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'peer',
          parentId TEXT,
          platform TEXT DEFAULT 'standard',
          platform_config TEXT,
          platform_type TEXT DEFAULT 'auto',
          unreachable INTEGER DEFAULT 0,
          FOREIGN KEY (parentId) REFERENCES servers(id)
        );
      `);
      for (const server of existingServers) {
        const insertColumns = Object.keys(server)
          .filter((key) => key !== "type")
          .join(", ");
        const placeholders = Object.keys(server)
          .filter((key) => key !== "type")
          .map(() => "?")
          .join(", ");
        const values = Object.keys(server)
          .filter((key) => key !== "type")
          .map((key) => server[key]);
        // Assumes 'id', 'label', 'url' are always present in old data
        db.prepare(
          `
          INSERT INTO servers_new (id, label, url, parentId, platform, platform_config, platform_type, unreachable, type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          server.id,
          server.label,
          server.url,
          server.parentId || null,
          server.platform || "standard",
          server.platform_config || null,
          server.platform_type || "auto",
          server.unreachable || 0,
          "peer"
        );
      }
      db.exec(`
        DROP TABLE servers;
        ALTER TABLE servers_new RENAME TO servers;
      `);
      dbLog(
        'Database schema migration for "type" column completed successfully'
      );
    } else {
      if (!columnNames.includes("platform")) {
        dbLog("Migrating database: Adding platform column to servers table");
        db.prepare(
          "ALTER TABLE servers ADD COLUMN platform TEXT DEFAULT 'standard'"
        ).run();
      }
      if (!columnNames.includes("platform_config")) {
        dbLog(
          "Migrating database: Adding platform_config column to servers table"
        );
        db.prepare("ALTER TABLE servers ADD COLUMN platform_config TEXT").run();
      }
      if (!columnNames.includes("platform_type")) {
        dbLog(
          "Migrating database: Adding platform_type column to servers table"
        );
        db.prepare(
          "ALTER TABLE servers ADD COLUMN platform_type TEXT DEFAULT 'auto'"
        ).run();
      }
    }
  } catch (migrationError) {
    dbError(
      "FATAL: Database schema migration failed:",
      migrationError.message,
      migrationError.stack || ""
    );
    // If migration fails, server may not be able to run.
  }
}

/**
 * Ensures a local server entry exists in the database and its URL/platform_type are appropriate.
 * @param {number} [port=3000] - The port to use in the local server URL.
 * @param {boolean} [appDebugEnabled=false] - Whether application-level debug is enabled.
 */
function ensureLocalServer(port = 3000, appDebugEnabled = false) {
  try {
    const columns = db.prepare("PRAGMA table_info(servers)").all();
    const columnNames = columns.map((col) => col.name);

    if (
      !columnNames.includes("type") ||
      !columnNames.includes("platform_type")
    ) {
      dbWarn(
        'Cannot ensure local server: "servers" table schema not fully migrated (missing "type" or "platform_type" column).'
      );
      return false;
    }

    const localServer = db
      .prepare("SELECT * FROM servers WHERE id = 'local'")
      .get();
    const targetUrl = `http://localhost:${port}`;
    const targetPlatformType = "auto";

    if (!localServer) {
      dbLog(
        `Adding local server to database. ID: local, URL: ${targetUrl}, Platform Type: ${targetPlatformType}`
      );
      db.prepare(
        `
        INSERT INTO servers (id, label, url, type, unreachable, platform_type) 
        VALUES ('local', 'Local Server', ?, 'local', 0, ?)
      `
      ).run(targetUrl, targetPlatformType);
    } else {
      let needsUpdate = false;
      let updateClauses = [];
      let updateValues = [];

      if (localServer.url !== targetUrl) {
        updateClauses.push("url = ?");
        updateValues.push(targetUrl);
        needsUpdate = true;
        dbLog(`Local server URL will be updated to ${targetUrl}.`);
      }
      if (localServer.platform_type !== targetPlatformType) {
        updateClauses.push("platform_type = ?");
        updateValues.push(targetPlatformType);
        needsUpdate = true;
        dbLog(
          `Local server platform_type will be reset to '${targetPlatformType}' for auto-detection.`
        );
      }
      if (localServer.type !== "local") {
        updateClauses.push("type = ?");
        updateValues.push("local");
        needsUpdate = true;
        dbLog(`Local server type will be corrected to 'local'.`);
      }

      if (needsUpdate) {
        updateValues.push("local");
        db.prepare(
          `UPDATE servers SET ${updateClauses.join(", ")} WHERE id = ?`
        ).run(...updateValues);
        dbLog("Local server entry updated.");
      } else {
        dbDebug(appDebugEnabled, "Local server entry already up-to-date.");
      }
    }
    return true;
  } catch (e) {
    dbError("Error ensuring local server exists:", e.message, e.stack || "");
    return false;
  }
}

/**
 * Updates the platform_type for the local server.
 * @param {string} platformType The new platform type (e.g., 'docker', 'truenas', 'system').
 * @param {boolean} [appDebugEnabled=false] - Whether application-level debug is enabled.
 */
function updateLocalServerPlatformType(platformType, appDebugEnabled = false) {
  try {
    if (!platformType || typeof platformType !== "string") {
      dbWarn(
        "Invalid platformType provided to updateLocalServerPlatformType. Received:",
        platformType
      );
      return;
    }
    const result = db
      .prepare("UPDATE servers SET platform_type = ? WHERE id = 'local'")
      .run(platformType);
    if (result.changes > 0) {
      dbLog(
        `Local server platform_type updated to '${platformType}' in database.`
      );
    } else {
      dbDebug(
        appDebugEnabled,
        `updateLocalServerPlatformType called with '${platformType}', but no changes were made to the database (current value might be the same or 'local' server missing).`
      );
    }
  } catch (e) {
    dbError(
      "Failed to update local server platform_type:",
      e.message,
      e.stack || ""
    );
  }
}

module.exports = db;
module.exports.ensureLocalServer = ensureLocalServer;
module.exports.updateLocalServerPlatformType = updateLocalServerPlatformType;
