/**
 * PORTS TRACKER - COLLECTOR REGISTRY
 *
 * This module manages all available collectors and provides
 * a factory method to create the appropriate collector for a platform.
 */

const BaseCollector = require("./base_collector");
const TrueNASCollector = require("./truenas_collector");
const DockerCollector = require("./docker_collector");
const SystemCollector = require("./system_collector");

const collectors = {
  base: BaseCollector,
  truenas: TrueNASCollector,
  docker: DockerCollector,
  system: SystemCollector,
};

/**
 * Create an appropriate collector for the given platform type
 * @param {string} platform Platform identifier
 * @param {Object} config Configuration for the collector
 * @returns {BaseCollector} A collector instance
 */
function createCollector(platform = "base", config = {}) {
  const CollectorClass = collectors[platform] || BaseCollector;
  return new CollectorClass(config);
}

/**
 * Auto-detect the best collector for the current system
 * @param {Object} config Configuration options
 * @returns {Promise<BaseCollector>} The best collector for this system
 */
async function detectCollector(config = {}) {
  const debug = config.debug || false;

  function logInfo(message) {
    console.log("[Collector] INFO:", message);
  }
  function logDebug(...args) {
    if (debug) {
      console.log("[Collector] DEBUG:", ...args);
    }
  }
  function logWarn(...args) {
    console.warn("[Collector] WARN:", ...args);
  }

  if (debug) {
    logDebug("--- detectCollector START ---");
    logDebug("Collector detection config:", config);
  }

  const collectorTypes = ["truenas", "docker", "system"];
  let bestCollector = null;
  let highestScore = -1;
  let detectionDetails = {};

  for (const type of collectorTypes) {
    if (!collectors[type]) continue;

    const collector = createCollector(type, { debug });
    logDebug(`Attempting compatibility check for ${type}...`);

    try {
      const score = await collector.isCompatible();
      detectionDetails[type] = score;

      if (debug) {
        logDebug(`Compatibility score for ${type}: ${score}`);
      }

      if (score > highestScore) {
        highestScore = score;
        bestCollector = collector;
        logDebug(
          `New best collector: ${type} (score: ${score}, previous best: ${highestScore})`
        );
      }
    } catch (err) {
      logWarn(`Error checking compatibility for ${type}:`, err.message);
      detectionDetails[type] = 0;
    }
  }

  if (debug) {
    logDebug(`Final detection scores:`, detectionDetails);
  }

  if (bestCollector && highestScore > 0) {
    const message = `Auto-detected ${bestCollector.platform} collector with score ${highestScore}`;
    logInfo(message);
    logDebug("--- detectCollector END (returning bestCollector) ---");
    return bestCollector;
  }

  const systemCollector = createCollector("system", { debug });
  logInfo(
    "No compatible collector detected with score > 0, using system collector"
  );
  logDebug("--- detectCollector END (returning system fallback) ---");
  return systemCollector;
}

/**
 * Register a new collector type
 * @param {string} platform Platform identifier
 * @param {Class} CollectorClass Collector class
 */
function registerCollector(platform, CollectorClass) {
  collectors[platform] = CollectorClass;
}

module.exports = {
  BaseCollector,
  createCollector,
  detectCollector,
  registerCollector,
  collectors,
};
