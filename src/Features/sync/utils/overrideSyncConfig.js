// overrideSyncConfig.js

/**
 * Creates a partial syncConfig object based on a provided list of keys and directions.
 * It overrides the direction field if specified in the input.
 *
 * @param {Object} syncConfig - The base syncConfig object
 * @param {Array} fileList - Array of objects like [{ key: 'project', direction: 'PUSH' }]
 * @returns {Object} - A new ordered subset of syncConfig with overridden directions
 */

export function overrideSyncConfig(syncConfig, fileList) {
  if (!fileList) return syncConfig;

  const result = {};

  for (const {key, direction} of fileList) {
    const configEntry = syncConfig[key];
    if (!configEntry) {
      console.warn(`[overrideSyncConfig] Unknown key: ${key}`);
      continue;
    }

    result[key] = {
      ...configEntry,
      direction: direction || configEntry.direction,
    };
  }

  return result;
}
