/**
 * TrueNAS JSON-RPC client library
 *
 * Provides communication with TrueNAS middleware primarily via WebSocket.
 * An API key is required for full functionality. If no API key is provided,
 * the client operates in a graceful degradation mode.
 * (Legacy Unix socket connection paths are currently not actively used by this client).
 */

const { connectWs } = require("./tn-ws");
const debugRPC = require("debug")("ports-tracker:truenas:rpc");

/**
 * TrueNAS middleware client using Unix socket first, WebSocket fallback
 */
class TrueNASClient {
  constructor(options = {}) {
    this.appDebugEnabled = options.debug || false;

    this.client = null;
    this.clientType = null;
    this.connected = false;
    this.apiKey = process.env.TRUENAS_API_KEY || options.apiKey;
    this.host = options.host;
    this.port = options.port;
  }

  /**
   * Log error message. This is now an unconditional error log.
   * @param {...any} args Arguments to log
   */
  logError(...args) {
    console.error("[TrueNAS-RPC]", ...args);
  }

  async connect() {
    if (this.connected) {
      return;
    }

    if (this.appDebugEnabled) {
      debugRPC("Attempting to connect...");
    }
    await this._doConnect();
  }

  async _doConnect() {
    try {
      if (this.appDebugEnabled) {
        debugRPC("Attempting WebSocket connection...");
      }

      if (!this.apiKey) {
        if (this.appDebugEnabled) {
          debugRPC(
            "ℹ️ No API key provided - TrueNAS enhanced features will be disabled. Setting up graceful degradation."
          );
        }
        this._setupGracefulDegradation();
        return;
      }

      if (this.appDebugEnabled) {
        debugRPC(
          "API key found - attempting authenticated WebSocket connection"
        );
      }
      const wsConnection = await connectWs({
        apiKey: this.apiKey,
        appDebugEnabled: this.appDebugEnabled,
        host: this.host,
        port: this.port,
      });
      this.client = wsConnection.requestFn;
      this.wsCloseFn = wsConnection.closeFn;
      this.clientType = "websocket";
      this.connected = true;
      if (this.appDebugEnabled) {
        debugRPC("Connected via WebSocket with authentication");
      }
    } catch (wsError) {
      if (this.appDebugEnabled) {
        debugRPC(`WebSocket connection failed: ${wsError.message}`);
      }
      this.logError(
        "WebSocket connection error:",
        wsError.message,
        wsError.stack || "(no stack)"
      );
      this._setupGracefulDegradation();
    }
  }

  _setupGracefulDegradation() {
    if (this.appDebugEnabled) {
      debugRPC("Setting up graceful degradation mode for TrueNASClient");
    }

    this.client = async (method) => {
      if (this.appDebugEnabled) {
        debugRPC(
          `TrueNAS method ${method} called in graceful degradation mode. No API call made.`
        );
      }
      if (method === "system.info") return Promise.resolve({});
      if (method === "app.query") return Promise.resolve([]);
      if (method === "virt.instance.query") return Promise.resolve([]);
      return Promise.resolve(null);
    };

    this.clientType = "graceful-degradation";
    this.connected = true;
    if (this.appDebugEnabled) {
      debugRPC("TrueNASClient graceful degradation active.");
    }
  }

  async call(method, params = []) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      if (this.appDebugEnabled) {
        debugRPC(`Calling TrueNAS API method: ${method} with params:`, params);
      }
      const result = await this.client(method, params);
      if (this.appDebugEnabled) {
        debugRPC(`Received response for ${method}`);
      }
      return result;
    } catch (err) {
      if (this.appDebugEnabled) {
        debugRPC(`Error calling TrueNAS API method ${method}:`, err.message);
      }
      this.logError(
        `TrueNAS RPC Error for method '${method}':`,
        err.message,
        err.stack || "(no stack)"
      );
      throw err;
    }
  }

  close() {
    if (this.wsCloseFn) {
      if (this.appDebugEnabled) {
        debugRPC("Closing TrueNASClient WebSocket connection via wsCloseFn");
      }
      this.wsCloseFn();
      this.wsCloseFn = null;
    }
    this.client = null;
    this.connected = false;
    if (this.appDebugEnabled) {
      debugRPC("TrueNASClient connection closed and reset.");
    }
  }
}

module.exports = { TrueNASClient };
