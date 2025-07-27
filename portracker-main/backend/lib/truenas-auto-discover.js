/**
 * TrueNAS Auto-Discovery Module
 * Automatically detects TrueNAS UI ports and WebSocket endpoints
 */

const fs = require("fs");
const debugDiscovery = require("debug")("ports-tracker:truenas:discovery");

/**
 * Discover TrueNAS UI configuration via Unix socket
 * @param {object} [options={}] - Options object
 * @param {boolean} [options.appDebugEnabled=false] - Whether application-level debug is enabled
 * @returns {Promise<Object|null>} UI configuration or null if failed
 */
async function discoverUIConfig(options = {}) {
  const { appDebugEnabled = false } = options;
  const socketPaths = [
    "/var/run/middlewared.sock",
    "/run/middlewared.sock",
    "/run/middleware/middlewared.sock",
  ];

  for (const socketPath of socketPaths) {
    if (!fs.existsSync(socketPath)) continue;

    try {
      if (appDebugEnabled) {
        debugDiscovery(`Attempting to discover UI config via ${socketPath}`);
      }
      const result = await callSocketMethod(
        socketPath,
        "system.general.config",
        { appDebugEnabled }
      );

      if (result) {
        const config = {
          httpsPort: result.ui_httpsport,
          httpPort: result.ui_port || result.ui_httpport,
          httpsEnabled: result.ui_https || result.ui_httpsredirect,
          address: result.ui_address || "127.0.0.1",
          certificate: result.ui_certificate,
        };

        if (appDebugEnabled) {
          debugDiscovery("Successfully discovered UI config:", config);
        }
        return config;
      }
    } catch (err) {
      if (appDebugEnabled) {
        debugDiscovery(`Failed to discover via ${socketPath}: ${err.message}`);
      }
      try {
        if (appDebugEnabled) {
          debugDiscovery(
            `Trying alternative method name (system.general.config again) for ${socketPath}`
          );
        }
        const result = await callSocketMethod(
          socketPath,
          "system.general.config",
          { appDebugEnabled }
        );
        if (result) {
          const config = {
            httpsPort: result.ui_httpsport,
            httpPort: result.ui_port || result.ui_httpport,
            httpsEnabled: result.ui_https || result.ui_httpsredirect,
            address: result.ui_address || "127.0.0.1",
            certificate: result.ui_certificate,
          };
          if (appDebugEnabled) {
            debugDiscovery(
              "Alternative method call worked for UI config:",
              config
            );
          }
          return config;
        }
      } catch (err2) {
        if (appDebugEnabled) {
          debugDiscovery(
            `Alternative method call also failed for ${socketPath}: ${err2.message}`
          );
        }
      }
    }
  }

  if (appDebugEnabled) {
    debugDiscovery("No UI config discovered from any socket");
  }
  return null;
}

/**
 * Call a method via Unix socket using HTTP protocol
 * @param {string} socketPath Path to Unix socket
 * @param {string} method Method to call
 * @param {object} [options={}] - Options object
 * @param {boolean} [options.appDebugEnabled=false] - Whether application-level debug is enabled
 * @returns {Promise<any>}
 */
function callSocketMethod(socketPath, method, options = {}) {
  const { appDebugEnabled = false } = options;
  return new Promise((resolve, reject) => {
    const http = require("http");

    const body =
      JSON.stringify({ id: 1, msg: "method", method, params: [] }) + "\n";

    const req = http.request(
      {
        socketPath: socketPath,
        path: "/_middleware",
        method: "POST",
        headers: {
          Host: "localhost",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            if (appDebugEnabled) {
              debugDiscovery(
                `HTTP response status from ${socketPath} for ${method}: ${res.statusCode}`
              );
            }
            if (res.statusCode !== 200) {
              return reject(
                new Error(`HTTP ${res.statusCode}: ${responseData}`)
              );
            }

            const response = JSON.parse(responseData);

            if (response.error) {
              reject(new Error(JSON.stringify(response.error)));
            } else {
              resolve(response.result);
            }
          } catch (err) {
            reject(
              new Error(
                `Failed to parse response from ${socketPath} for ${method}: ${err.message}`
              )
            );
          }
        });
      }
    );

    req.on("error", (err) => {
      if (appDebugEnabled) {
        debugDiscovery(
          `Socket request error for ${socketPath} method ${method}: ${err.message}`
        );
      }
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error("Socket timeout"));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Detect network environment and get appropriate host addresses
 * @param {object} [options={}] - Options object
 * @param {boolean} [options.appDebugEnabled=false] - Whether application-level debug is enabled
 * @returns {Array<string>} Host addresses to try
 */
function detectHostAddresses(options = {}) {
  const hostAddresses = [];

  hostAddresses.push("127.0.0.1", "localhost");

  const isContainerEnvironment =
    process.env.DOCKER_HOST || fs.existsSync("/.dockerenv");

  if (isContainerEnvironment) {
    hostAddresses.push("host.docker.internal");
    hostAddresses.push("172.17.0.1");
  }
  return hostAddresses;
}

/**
 * Generate WebSocket URLs based on discovered or fallback configuration
 * @param {Object|null} uiConfig Discovered UI configuration
 * @param {object} [options={}] - Options object
 * @param {boolean} [options.appDebugEnabled=false] - Whether application-level debug is enabled
 * @returns {Array<string>} Array of WebSocket URLs to try
 */
function generateWebSocketURLs(uiConfig = null, options = {}) {
  const { appDebugEnabled = false } = options;
  const urls = [];

  const explicitBase = process.env.TRUENAS_WS_BASE;
  if (explicitBase) {
    const wsBase = explicitBase.replace(/^http/, "ws");
    urls.push(`${wsBase}/websocket`);
    if (appDebugEnabled) {
      debugDiscovery(`Added explicit WebSocket URL: ${wsBase}/websocket`);
    }
    if (urls.length > 0) {
      return urls;
    }
  }

  const hostAddresses = detectHostAddresses({ appDebugEnabled });

  if (uiConfig) {
    if (appDebugEnabled) {
      debugDiscovery(
        "Using discovered UI configuration for WebSocket URLs:",
        uiConfig
      );
    }
    for (const host of hostAddresses) {
      if (uiConfig.httpsEnabled && uiConfig.httpsPort) {
        const url = `wss://${host}:${uiConfig.httpsPort}/websocket`;
        urls.push(url);
        if (appDebugEnabled) {
          debugDiscovery(`Added discovered HTTPS WebSocket: ${url}`);
        }
      }

      if (uiConfig.httpPort) {
        const url = `ws://${host}:${uiConfig.httpPort}/websocket`;
        urls.push(url);
        if (appDebugEnabled) {
          debugDiscovery(`Added discovered HTTP WebSocket: ${url}`);
        }
      }
    }
  }

  if (!uiConfig) {
    if (appDebugEnabled) {
      debugDiscovery("No UI config discovered, using generic fallback ports");
    }
    const commonPorts = [
      { port: 443, protocol: "wss" },
      { port: 80, protocol: "ws" },
      { port: 8443, protocol: "wss" },
      { port: 8080, protocol: "ws" },
    ];

    for (const host of hostAddresses) {
      for (const { port, protocol } of commonPorts) {
        const url = `${protocol}://${host}:${port}/websocket`;
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }
    }
  }

  if (appDebugEnabled) {
    debugDiscovery(`Generated ${urls.length} WebSocket URLs to try`);
  }
  return urls;
}

module.exports = {
  discoverUIConfig,
  generateWebSocketURLs,
};
