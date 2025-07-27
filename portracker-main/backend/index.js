/**
 * PORTS TRACKER - BACKEND SERVER
 *
 * Production-ready backend server for the Ports Tracker application.
 * Provides RESTful API endpoints for server management, port scanning,
 * and system monitoring across multiple deployment platforms.
 */

const express = require("express");
const cors = require("cors");
const db = require("./db");
const { createCollector, detectCollector } = require("./collectors");
const path = require("path");
const net = require("net");
const http = require("http");
const https = require("https");
// const fetch = require("node-fetch");

const PING_TIMEOUT = 2000;

async function testProtocol(scheme, host_ip, port, path = "/") {
  const client = scheme === "https" ? https : http;
  const options = {
    hostname: host_ip,
    port,
    path,
    timeout: PING_TIMEOUT,
    family: 4,
  };
  if (scheme === "https") options.rejectUnauthorized = false;

  try {
    const headRes = await new Promise((resolve, reject) => {
      const req = client.request({ ...options, method: "HEAD" }, (res) => {
        res.resume();
        resolve(res);
      });
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.on("error", reject);
      req.end();
    });
    if (headRes.statusCode >= 200 && headRes.statusCode < 300)
      return { success: true, statusCode: headRes.statusCode };
    if (
      headRes.statusCode >= 300 &&
      headRes.statusCode < 400 &&
      headRes.headers.location
    )
      return {
        success: true,
        statusCode: headRes.statusCode,
        redirected: true,
      };
  } catch (headError) {
    if (debug || (headError && headError.message !== "timeout")) {
      console.log(
        `[Server] DEBUG: testProtocol HEAD ${scheme}://${host_ip}:${port}${path} failed: ${headError.message}`
      );
    }
  }

  try {
    const getRes = await new Promise((resolve, reject) => {
      const req = client.request({ ...options, method: "GET" }, (res) => {
        res.resume();
        resolve(res);
      });
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.on("error", reject);
      req.end();
    });
    if (getRes.statusCode >= 200 && getRes.statusCode < 300)
      return { success: true, statusCode: getRes.statusCode };
    if (
      getRes.statusCode >= 300 &&
      getRes.statusCode < 400 &&
      getRes.headers.location
    )
      return { success: true, statusCode: getRes.statusCode, redirected: true };
    return { success: false, statusCode: getRes.statusCode };
  } catch (getError) {
    if (debug || (getError && getError.message !== "timeout")) {
      console.log(
        `[Server] DEBUG: testProtocol GET ${scheme}://${host_ip}:${port}${path} failed: ${getError.message}`
      );
    }
    return { success: false, reason: getError.message };
  }
}

// Verify database schema before starting the server
try {
  const columns = db.prepare("PRAGMA table_info(servers)").all();
  const columnNames = columns.map((col) => col.name);

  if (!columnNames.includes("type")) {
    console.warn(
      '[Server] WARN: Database schema migration may be needed. The "servers" table "type" column is missing.'
    );
    console.warn(
      "[Server] WARN: This might affect functionality. Consider checking database setup or migrations."
    );
  } else {
    console.log("[Server] INFO: Database schema verification successful.");
  }
  db.ensureLocalServer(process.env.PORT || 3000);
} catch (error) {
  console.error(
    "[Server] FATAL: Database verification failed:",
    error.message,
    error.stack || ""
  );
}

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;
let debug = false;

/**
 * Get all ports from local system using collector framework.
 */
app.get("/api/ports", async (req, res) => {
  debug = req.query.debug === "true";
  if (debug) {
    console.log(`[Server] DEBUG: GET /api/ports called with debug=${debug}`);
  }
  try {
    const entries = [];
    const dockerCollector = createCollector("docker", { debug });
    const dockerPorts = await dockerCollector.getPorts();
    entries.push(...dockerPorts);
    const systemCollector = createCollector("system", { debug });
    const systemPorts = await systemCollector.getPorts();
    entries.push(...systemPorts);

    const normalized = entries
      .filter((e) => e.host_port && e.host_ip)
      .reduce((acc, entry) => {
        const key = `${entry.host_ip}:${entry.host_port}`;
        if (!acc[key]) {
          acc[key] = {
            ...entry,
            owners: [entry.owner],
            pids: [entry.pid].filter(Boolean),
          };
        } else {
          if (!acc[key].owners.includes(entry.owner)) {
            acc[key].owners.push(entry.owner);
          }
          if (entry.pid && !acc[key].pids.includes(entry.pid)) {
            acc[key].pids.push(entry.pid);
          }
        }
        return acc;
      }, {});

    res.json(
      Object.values(normalized).map((e) => ({
        ...e,
        owner: e.owners.join(", "),
      }))
    );
  } catch (error) {
    console.error(
      "[Server] ERROR: Error in GET /api/ports:",
      error.message,
      error.stack || ""
    );
    res
      .status(500)
      .json({ error: "Failed to scan ports", details: error.message });
  }
});

/**
 * New peer-based endpoint to replace remote API connectivity
 */
app.get("/api/all-ports", async (req, res) => {
  debug = req.query.debug === "true";
  if (debug) {
    console.log(
      `[Server] DEBUG: GET /api/all-ports called with debug=${debug}`
    );
  }
  try {
    const servers = db.prepare("SELECT * FROM servers").all();

    const results = servers.map((s) => ({
      id: s.id,
      server: s.label,
      ok: s.id === "local",
      error: s.id !== "local" ? "Peer communication not yet implemented" : null,
      data: s.id === "local" ? [] : [],
      parentId: s.parentId,
      platform_type: s.platform_type || "unknown",
    }));

    const localServerResult = results.find((s) => s.id === "local");
    if (localServerResult) {
      try {
        const localPorts = await getLocalPortsUsingCollectors({ debug });
        localServerResult.data = localPorts;
        localServerResult.ok = true;
      } catch (localError) {
        console.error(
          "[Server] ERROR: Failed to get local ports for /api/all-ports:",
          localError.message
        );
        localServerResult.ok = false;
        localServerResult.error = `Failed to collect local ports: ${localError.message}`;
      }
    }

    res.json(results);
  } catch (error) {
    console.error(
      "[Server] ERROR: Error in GET /api/all-ports:",
      error.message,
      error.stack || ""
    );
    res
      .status(500)
      .json({ error: "Failed to process all ports", details: error.message });
  }
});

/**
 * Get local ports using the best available collector
 */
async function getLocalPortsUsingCollectors(options = {}) {
  const currentDebug = options.debug || debug;

  try {
    if (currentDebug) {
      console.log(
        "[Server] DEBUG: [getLocalPortsUsingCollectors] Starting port collection..."
      );
    }

    const collector = await detectCollector({ debug: currentDebug });
    if (currentDebug) {
      console.log(
        `[Server] DEBUG: [getLocalPortsUsingCollectors] Detected collector: ${collector?.platform}`
      );
    }

    const ports = await collector.getPorts();
    if (currentDebug) {
      console.log(
        `[Server] DEBUG: [getLocalPortsUsingCollectors] Collected ${
          ports?.length || 0
        } ports.`
      );
    }
    return ports;
  } catch (error) {
    console.error(
      "[Server] ERROR: [getLocalPortsUsingCollectors] Primary collection attempt failed:",
      error.message,
      error.stack || ""
    );
    throw error;
  }
}

/**
 * New endpoint to scan a server with the appropriate collector
 */
app.get("/api/servers/:id/scan", async (req, res) => {
  const serverId = req.params.id;
  const currentDebug = req.query.debug === "true" || debug;
  if (currentDebug) {
    console.log(
      `[Server] DEBUG: GET /api/servers/${serverId}/scan called with debug=${currentDebug}`
    );
  }

  try {
    const server = db
      .prepare("SELECT * FROM servers WHERE id = ?")
      .get(serverId);

    if (!server) {
      console.warn(
        `[Server] WARN: [GET /api/servers/${serverId}/scan] Server not found.`
      );
      return res.status(404).json({ error: "Server not found" });
    }

    if (serverId === "local") {
      const platformType = server.platform_type || "auto";
      let collector;

      if (currentDebug) {
        console.log(
          `[Server] DEBUG: [GET /api/servers/local/scan] Local server platform_type: ${platformType}`
        );
      }

      if (platformType === "auto") {
        collector = await detectCollector({ debug: currentDebug });
      } else {
        collector = createCollector(platformType, { debug: currentDebug });
      }

      const collectData = await collector.collectAll();

      if (collectData.ports && Array.isArray(collectData.ports)) {
        const enrichedPorts = collectData.ports.map((port) => {
          const noteEntry = db
            .prepare(
              "SELECT note FROM notes WHERE server_id = 'local' AND host_ip = ? AND host_port = ?"
            )
            .get(port.host_ip, port.host_port);
          const ignoreEntry = db
            .prepare(
              "SELECT 1 FROM ignores WHERE server_id = 'local' AND host_ip = ? AND host_port = ?"
            )
            .get(port.host_ip, port.host_port);
          return {
            ...port,
            note: noteEntry ? noteEntry.note : null,
            ignored: !!ignoreEntry,
          };
        });
        collectData.ports = enrichedPorts;
      }

      if (
        platformType === "auto" &&
        collectData.platform &&
        server.platform_type !== collectData.platform
      ) {
        db.updateLocalServerPlatformType(collectData.platform);
      }
      console.log(
        `[Server] INFO: [GET /api/servers/local/scan] Successfully scanned. Collector: ${
          collector?.platform
        }, Apps: ${collectData.apps?.length || 0}, Ports: ${
          collectData.ports?.length || 0
        }, VMs: ${collectData.vms?.length || 0}`
      );
      return res.json(collectData);
    }

    if (server.type === "peer" && server.url) {
      if (currentDebug) {
        console.log(
          `[Server] DEBUG: [GET /api/servers/${serverId}/scan] Attempting to scan remote peer at URL: ${server.url}`
        );
      }
      try {
        const peerScanUrl = new URL("/api/servers/local/scan", server.url).href;
        if (currentDebug) {
          console.log(
            `[Server] DEBUG: [GET /api/servers/${serverId}/scan] Fetching from peer URL: ${peerScanUrl}`
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
          const peerResponse = await fetch(peerScanUrl, { 
            signal: controller.signal 
          });
          clearTimeout(timeoutId);

          if (!peerResponse.ok) {
            let errorBody = "Peer responded with an error.";
            try {
              errorBody = await peerResponse.text();
            } catch (e) {
              /* ignore */
            }
            console.warn(
              `[Server] WARN: [GET /api/servers/${serverId}/scan] Peer server at ${server.url} responded with status ${peerResponse.status}. Body: ${errorBody}`
            );
            return res.status(peerResponse.status).json({
              error: `Peer server scan failed with status ${peerResponse.status}`,
              details: errorBody,
              serverId: serverId,
              peerUrl: server.url,
            });
          }

          const peerScanData = await peerResponse.json();
          if (currentDebug) {
            console.log(
              `[Server] DEBUG: [GET /api/servers/${serverId}/scan] Successfully received scan data from peer ${serverId}`
            );
          }
          console.log(
            `[Server] INFO: [GET /api/servers/${serverId}/scan] Successfully scanned remote peer. Peer: ${server.label} (${serverId})`
          );
          return res.json(peerScanData);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error(
              `[Server] ERROR: [GET /api/servers/${serverId}/scan] Timeout after 15s communicating with peer ${server.label} at ${server.url}`
            );
            return res.status(408).json({
              error: "Request timeout - peer server took too long to respond",
              details: "Connection timed out after 15 seconds",
              serverId: serverId,
              peerUrl: server.url,
            });
          }
          throw fetchError;
        }
      } catch (fetchError) {
        console.error(
          `[Server] ERROR: [GET /api/servers/${serverId}/scan] Failed to fetch scan data from peer ${server.label} at ${server.url}:`,
          fetchError.message
        );
        return res.status(502).json({
          error: "Failed to communicate with peer server",
          details: fetchError.message,
          serverId: serverId,
          peerUrl: server.url,
        });
      }
    } else {
      console.warn(
        `[Server] WARN: [GET /api/servers/${serverId}/scan] Cannot scan server: Not 'local' and not a valid 'peer' with a URL.`
      );
      return res.status(501).json({
        error:
          "Server scanning not possible for this server type or configuration",
        server_id: serverId,
      });
    }
  } catch (error) {
    console.error(
      `[Server] ERROR: Error in GET /api/servers/${serverId}/scan:`,
      error.message,
      error.stack || ""
    );
    res
      .status(500)
      .json({ error: "Failed to scan server", details: error.message });
  }
});

function validateServerInput(req, res, next) {
  const { label, url, type, platform_type } = req.body;
  if (!label || typeof label !== "string" || label.trim().length === 0) {
    return res
      .status(400)
      .json({
        error: "Validation failed",
        details: "Field 'label' is required and must be a non-empty string",
        field: "label",
      });
  }
  if (
    type === "peer" &&
    url &&
    typeof url === "string" &&
    url.trim().length > 0
  ) {
    try {
      new URL(url.trim());
    } catch (e) {
      return res
        .status(400)
        .json({
          error: "Validation failed",
          details:
            "Field 'url' must be a valid URL format if provided for a peer",
          field: "url",
        });
    }
  } else if (
    type === "peer" &&
    (!url || url.trim().length === 0) &&
    !req.body.unreachable
  ) {
    // A reachable peer must have a URL. This is validated in the POST /api/servers endpoint
  }

  req.body.type = type || "peer";
  req.body.platform_type = platform_type || "unknown";
  req.body.label = label.trim();
  req.body.url = url ? url.trim() : null;
  next();
}

function validateNoteInput(req, res, next) {
  const { server_id, host_ip, host_port, note } = req.body;
  if (!server_id || typeof server_id !== "string") {
    return res
      .status(400)
      .json({
        error: "Validation failed",
        details: "Field 'server_id' is required and must be a string",
        field: "server_id",
      });
  }
  if (!host_ip || typeof host_ip !== "string") {
    return res
      .status(400)
      .json({
        error: "Validation failed",
        details: "Field 'host_ip' is required and must be a string",
        field: "host_ip",
      });
  }
  if (
    host_port === undefined ||
    host_port === null ||
    !Number.isInteger(Number(host_port))
  ) {
    return res
      .status(400)
      .json({
        error: "Validation failed",
        details:
          "Field 'host_port' is required and must be a valid port number",
        field: "host_port",
      });
  }
  const serverExists = db
    .prepare("SELECT id FROM servers WHERE id = ?")
    .get(server_id);
  if (!serverExists) {
    return res
      .status(404)
      .json({
        error: "Validation failed",
        details: `Server with id '${server_id}' not found`,
        field: "server_id",
      });
  }
  next();
}

function validateServerIdParam(req, res, next) {
  const serverId = req.params.id;
  if (
    !serverId ||
    typeof serverId !== "string" ||
    serverId.trim().length === 0
  ) {
    return res
      .status(400)
      .json({
        error: "Validation failed",
        details:
          "Server ID parameter is required and must be a non-empty string",
        field: "id",
      });
  }
  next();
}

app.get("/api/servers", (req, res) => {
  console.log("[Server] INFO: Received GET /api/servers request");
  try {
    const stmt = db.prepare(
      "SELECT id, label, url, parentId, type, unreachable, platform_type FROM servers"
    );
    const servers = stmt.all();
    console.log(
      `[Server] INFO: Sending ${servers.length} servers in /api/servers response`
    );
    res.json(servers);
  } catch (error) {
    console.error(
      "[Server] ERROR: Failed to get servers:",
      error.message,
      error.stack || ""
    );
    res
      .status(500)
      .json({ error: "Failed to retrieve servers", details: error.message });
  }
});

app.post("/api/servers", validateServerInput, (req, res) => {
  const { id, label, url, parentId, type, unreachable, platform_type } =
    req.body;

  if (!id) {
    return res.status(400).json({ error: "Field 'id' is required" });
  }

  if (type === "peer" && !unreachable && (!url || url.trim().length === 0)) {
    return res
      .status(400)
      .json({
        error: "Validation failed",
        details: "Field 'url' is required for reachable peer servers",
        field: "url",
      });
  }

  const dbUnreachable = unreachable ? 1 : 0;

  try {
    const existing = db.prepare("SELECT id FROM servers WHERE id = ?").get(id);
    if (existing) {
      db.prepare(
        "UPDATE servers SET label = ?, url = ?, parentId = ?, type = ?, unreachable = ?, platform_type = ? WHERE id = ?"
      ).run(
        label,
        url,
        parentId || null,
        type,
        dbUnreachable,
        platform_type,
        id
      );
      console.log(
        `[Server] INFO: Server updated successfully. ID: ${id}, Label: "${label}"`
      );
      res.status(200).json({ message: "Server updated successfully", id });
    } else {
      db.prepare(
        "INSERT INTO servers (id, label, url, parentId, type, unreachable, platform_type) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        id,
        label,
        url,
        parentId || null,
        type,
        dbUnreachable,
        platform_type
      );
      console.log(
        `[Server] INFO: Server added successfully. ID: ${id}, Label: "${label}"`
      );
      res.status(201).json({ message: "Server added successfully", id });
    }
  } catch (error) {
    console.error(
      `[Server] ERROR: Database error in POST /api/servers (ID: ${id}):`,
      error.message,
      error.stack || ""
    );
    if (error.message.includes("UNIQUE constraint failed")) {
      return res
        .status(409)
        .json({ error: `Server with ID '${id}' already exists.` });
    }
    if (
      error.message.toLowerCase().includes("can only bind") ||
      error.message.toLowerCase().includes("datatype mismatch")
    ) {
      console.error(
        `[Server] ERROR DETAIL: Possible data binding/type issue for server ID ${id}. Payload received: ${JSON.stringify(
          req.body
        )}`
      );
      return res
        .status(500)
        .json({
          error: "Failed to save server due to data type issue.",
          details: error.message,
        });
    }
    res
      .status(500)
      .json({ error: "Failed to save server", details: error.message });
  }
});

app.delete("/api/servers/:id", validateServerIdParam, (req, res) => {
  const serverId = req.params.id;
  const currentDebug = req.query.debug === "true" || debug;

  if (currentDebug) {
    console.log(
      `[Server] DEBUG: [DELETE /api/servers/${serverId}] Request received.`
    );
  }

  try {
    const server = db
      .prepare("SELECT id, label FROM servers WHERE id = ?")
      .get(serverId);
    if (!server) {
      console.warn(
        `[Server] WARN: [DELETE /api/servers/${serverId}] Attempt to delete non-existent server.`
      );
      return res
        .status(404)
        .json({ error: "Server not found", server_id: serverId });
    }

    if (serverId === "local") {
      console.warn(
        `[Server] WARN: [DELETE /api/servers/${serverId}] Attempt to delete 'local' server.`
      );
      return res
        .status(400)
        .json({ error: "Cannot delete local server", server_id: serverId });
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare("UPDATE servers SET parentId = NULL WHERE parentId = ?").run(
        serverId
      );
      db.prepare("DELETE FROM notes WHERE server_id = ?").run(serverId);
      db.prepare("DELETE FROM ignores WHERE server_id = ?").run(serverId);
      db.prepare("DELETE FROM servers WHERE id = ?").run(serverId);
    });
    deleteTransaction();

    console.log(
      `[Server] INFO: Server deleted successfully. ID: ${serverId}, Label: "${server.label}"`
    );
    res.json({
      success: true,
      message: `Server '${server.label}' (ID: ${serverId}) deleted successfully`,
    });
  } catch (err) {
    if (err.message.includes("FOREIGN KEY constraint failed")) {
      console.error(
        `[Server] ERROR: FOREIGN KEY constraint failed during DELETE /api/servers/${serverId}:`,
        err.message,
        err.stack || ""
      );
      return res.status(409).json({
        error: "Conflict deleting server",
        details:
          "Cannot delete server due to existing references. Ensure all child items or dependencies are handled.",
        rawError: err.message,
      });
    }
    console.error(
      `[Server] ERROR: Database error in DELETE /api/servers/${serverId}:`,
      err.message,
      err.stack || ""
    );
    res
      .status(500)
      .json({
        error: "Database operation failed",
        details: "Unable to delete server",
        rawError: err.message,
      });
  }
});

app.post("/api/notes", validateNoteInput, (req, res) => {
  const { server_id, host_ip, host_port, note } = req.body;
  const currentDebug = req.query.debug === "true" || debug;
  const noteTrimmed = note ? note.trim() : "";

  if (currentDebug) {
    console.log(
      `[Server] DEBUG: POST /api/notes for ${server_id} ${host_ip}:${host_port}. Note: "${noteTrimmed}"`
    );
  }

  try {
    const existing = db
      .prepare(
        "SELECT server_id FROM notes WHERE server_id = ? AND host_ip = ? AND host_port = ?"
      )
      .get(server_id, host_ip, host_port);
    if (existing) {
      if (noteTrimmed === "") {
        db.prepare(
          "DELETE FROM notes WHERE server_id = ? AND host_ip = ? AND host_port = ?"
        ).run(server_id, host_ip, host_port);
        console.log(
          `[Server] INFO: Note deleted for ${server_id} ${host_ip}:${host_port}`
        );
      } else {
        db.prepare(
          "UPDATE notes SET note = ?, updated_at = datetime('now') WHERE server_id = ? AND host_ip = ? AND host_port = ?"
        ).run(noteTrimmed, server_id, host_ip, host_port);
        console.log(
          `[Server] INFO: Note updated for ${server_id} ${host_ip}:${host_port}`
        );
      }
    } else if (noteTrimmed !== "") {
      db.prepare(
        "INSERT INTO notes (server_id, host_ip, host_port, note) VALUES (?, ?, ?, ?)"
      ).run(server_id, host_ip, host_port, noteTrimmed);
      console.log(
        `[Server] INFO: Note created for ${server_id} ${host_ip}:${host_port}`
      );
    }
    res.status(200).json({ success: true, message: "Note saved successfully" });
  } catch (err) {
    console.error(
      `[Server] ERROR: Database error in POST /api/notes:`,
      err.message,
      err.stack || ""
    );
    res
      .status(500)
      .json({
        error: "Database operation failed",
        details: "Unable to save note",
      });
  }
});

app.get("/api/notes", (req, res) => {
  const { server_id } = req.query;
  const currentDebug = req.query.debug === "true" || debug;

  if (currentDebug) {
    console.log(`[Server] DEBUG: GET /api/notes for server_id: ${server_id}`);
  }

  if (!server_id) {
    return res
      .status(400)
      .json({ error: "server_id query parameter is required" });
  }

  try {
    const notes = db
      .prepare("SELECT host_ip, host_port, note FROM notes WHERE server_id = ?")
      .all(server_id);
    res.json(notes);
  } catch (err) {
    console.error(
      `[Server] ERROR: Database error in GET /api/notes:`,
      err.message,
      err.stack || ""
    );
    res
      .status(500)
      .json({
        error: "Database operation failed",
        details: "Unable to retrieve notes",
      });
  }
});

app.post("/api/ignores", (req, res) => {
  const { server_id, host_ip, host_port, ignored } = req.body;
  const currentDebug = req.query.debug === "true" || debug;

  if (currentDebug) {
    console.log(
      `[Server] DEBUG: POST /api/ignores for ${server_id} ${host_ip}:${host_port}. Ignored: ${ignored}`
    );
  }

  if (
    !server_id ||
    typeof server_id !== "string" ||
    !host_ip ||
    typeof host_ip !== "string" ||
    host_port === undefined ||
    host_port === null ||
    !Number.isInteger(Number(host_port)) ||
    typeof ignored !== "boolean"
  ) {
    return res.status(400).json({ error: "Invalid input for ignore entry" });
  }

  try {
    const existing = db
      .prepare(
        "SELECT server_id FROM ignores WHERE server_id = ? AND host_ip = ? AND host_port = ?"
      )
      .get(server_id, host_ip, host_port);

    if (ignored) {
      if (!existing) {
        db.prepare(
          "INSERT INTO ignores (server_id, host_ip, host_port) VALUES (?, ?, ?)"
        ).run(server_id, host_ip, host_port);
        console.log(
          `[Server] INFO: Port ignored for ${server_id} ${host_ip}:${host_port}`
        );
      } else {
        if (currentDebug)
          console.log(
            `[Server] DEBUG: Port already ignored for ${server_id} ${host_ip}:${host_port}, no change.`
          );
      }
    } else {
      if (existing) {
        db.prepare(
          "DELETE FROM ignores WHERE server_id = ? AND host_ip = ? AND host_port = ?"
        ).run(server_id, host_ip, host_port);
        console.log(
          `[Server] INFO: Port un-ignored for ${server_id} ${host_ip}:${host_port}`
        );
      } else {
        if (currentDebug)
          console.log(
            `[Server] DEBUG: Port already not ignored for ${server_id} ${host_ip}:${host_port}, no change.`
          );
      }
    }
    res.status(200).json({ success: true, message: "Ignore status updated" });
  } catch (err) {
    console.error(
      `[Server] ERROR: Database error in POST /api/ignores:`,
      err.message,
      err.stack || ""
    );
    res
      .status(500)
      .json({
        error: "Database operation failed",
        details: "Unable to update ignore status",
      });
  }
});

app.get("/api/ignores", (req, res) => {
  const { server_id } = req.query;
  const currentDebug = req.query.debug === "true" || debug;

  if (currentDebug) {
    console.log(`[Server] DEBUG: GET /api/ignores for server_id: ${server_id}`);
  }

  if (!server_id) {
    return res
      .status(400)
      .json({ error: "server_id query parameter is required" });
  }

  try {
    const ignores = db
      .prepare("SELECT host_ip, host_port FROM ignores WHERE server_id = ?")
      .all(server_id);
    res.json(ignores.map((item) => ({ ...item, ignored: true })));
  } catch (err) {
    console.error(
      `[Server] ERROR: Database error in GET /api/ignores:`,
      err.message,
      err.stack || ""
    );
    res
      .status(500)
      .json({
        error: "Database operation failed",
        details: "Unable to retrieve ignores",
      });
  }
});

app.get("/api/ping", async (req, res) => {
  const { host_ip, host_port, target_server_url } = req.query;
  const currentDebug = req.query.debug === "true" || debug;

  if (!host_ip || !host_port) {
    return res
      .status(400)
      .json({ error: "host_ip and host_port are required" });
  }
  const portNum = parseInt(host_port, 10);
  if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
    return res.status(400).json({ error: "Invalid host_port" });
  }

  let pingable_host_ip = host_ip;
  const isBackendInDocker = process.env.RUNNING_IN_DOCKER === "true";

  if (
    target_server_url &&
    (host_ip === "0.0.0.0" ||
      host_ip === "127.0.0.1" ||
      host_ip === "[::]" ||
      host_ip === "[::1]")
  ) {
    try {
      const peerUrlObj = new URL(target_server_url);
      pingable_host_ip = peerUrlObj.hostname;
      if (currentDebug) {
        console.log(
          `[Server] DEBUG: [GET /api/ping] Remapping generic host_ip '${host_ip}' to peer host '${pingable_host_ip}' from target_server_url for port ${host_port}.`
        );
      }
    } catch (e) {
      console.error(
        `[Server] ERROR: [GET /api/ping] Invalid target_server_url: ${target_server_url}`,
        e.message
      );
    }
  } else if (
    isBackendInDocker &&
    (host_ip === "0.0.0.0" ||
      host_ip === "127.0.0.1" ||
      host_ip === "[::]" ||
      host_ip === "[::1]")
  ) {
    pingable_host_ip = "host.docker.internal";
    if (currentDebug) {
      console.log(
        `[Server] DEBUG: [GET /api/ping] Remapping generic host_ip '${host_ip}' to 'host.docker.internal' for local Docker ping to port ${host_port}.`
      );
    }
  } else if (currentDebug) {
    console.log(
      `[Server] DEBUG: [GET /api/ping] Pinging ${pingable_host_ip}:${portNum} (isBackendInDocker: ${isBackendInDocker}, target_server_url: ${
        target_server_url || "N/A"
      }).`
    );
  }

  let finalReachable = false;
  let finalProtocol = "http";

  if (currentDebug) {
    console.log(
      `[Server] DEBUG: [GET /api/ping] Attempting HTTPS for ${pingable_host_ip}:${portNum}`
    );
  }
  const httpsResponse = await testProtocol("https", pingable_host_ip, portNum);

  if (httpsResponse.success) {
    finalReachable = true;
    finalProtocol = "https";
    if (currentDebug) {
      console.log(
        `[Server] DEBUG: [GET /api/ping] HTTPS success for ${pingable_host_ip}:${portNum}`
      );
    }
  } else {
    if (currentDebug) {
      console.log(
        `[Server] DEBUG: [GET /api/ping] HTTPS failed for ${pingable_host_ip}:${portNum}. Reason: ${
          httpsResponse.reason || `Status: ${httpsResponse.statusCode}`
        }. Attempting HTTP.`
      );
    }
    const httpResponse = await testProtocol("http", pingable_host_ip, portNum);
    if (httpResponse.success) {
      finalReachable = true;
      finalProtocol = "http";
      if (currentDebug) {
        console.log(
          `[Server] DEBUG: [GET /api/ping] HTTP success for ${pingable_host_ip}:${portNum}`
        );
      }
    } else {
      if (currentDebug) {
        console.log(
          `[Server] DEBUG: [GET /api/ping] HTTP also failed for ${pingable_host_ip}:${portNum}. Reason: ${
            httpResponse.reason || `Status: ${httpResponse.statusCode}`
          }`
        );
      }
    }
  }
  if (currentDebug) {
    console.log(
      `[Server] DEBUG: [GET /api/ping] Ping result for ${pingable_host_ip}:${portNum} -> reachable: ${finalReachable}, protocol: ${finalProtocol}`
    );
  }
  res.json({ reachable: finalReachable, protocol: finalProtocol });
});

app.get("/api/health", (req, res) => {
  console.log("[Server] INFO: Received GET /api/health request");
  try {
    const dbCheck = db.prepare("SELECT 1").get();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    console.log("[Server] INFO: Sending /api/health response");
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: uptime,
      memory: { rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB` },
      database: "connected",
    });
  } catch (error) {
    console.error(
      "[Server] ERROR: Health check failed:",
      error.message,
      error.stack || ""
    );
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      database: "disconnected_or_error",
    });
  }
});

const staticPath = path.join(__dirname, "public");
console.log(
  `[Server] INFO: Attempting to serve static files from: ${staticPath}`
);
app.use(express.static(staticPath, { fallthrough: true, index: false }));

app.get("*", (req, res, next) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  console.log(
    `[Server] INFO: Catch-all GET '*' received for path: ${req.path}. Attempting to serve: ${indexPath}`
  );
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(
        `[Server] ERROR: Failed to send ${indexPath} for ${req.path}:`,
        err.message
      );
      if (!res.headersSent) {
        res.status(404).json({
          error: "Frontend entry point not found",
          details: `Could not serve ${indexPath}. Ensure frontend is built and in public directory. Error: ${err.message}`,
        });
      }
    } else {
      console.log(
        `[Server] INFO: Successfully sent ${indexPath} for ${req.path}`
      );
    }
  });
});

app.use((err, req, res, next) => {
  console.error(
    "[Server] FATAL: Unhandled error in Express middleware:",
    err.stack || err.message
  );
  if (!res.headersSent) {
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  } else {
    next(err);
  }
});

console.log(`[Server] INFO: About to call app.listen on port ${PORT}`);
try {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Server] INFO: Server is now listening on http://0.0.0.0:${PORT}`
    );
    console.log(`[Server] INFO: Full startup message complete.`);
  });
} catch (listenError) {
  console.error(
    "[Server] FATAL: app.listen failed to start:",
    listenError.message,
    listenError.stack || ""
  );
  process.exit(1);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "[Server] FATAL: Unhandled Rejection at:",
    promise,
    "reason:",
    reason
  );
});

process.on("uncaughtException", (error) => {
  console.error(
    "[Server] FATAL: Uncaught Exception:",
    error.stack || error.message
  );
  process.exit(1);
});
