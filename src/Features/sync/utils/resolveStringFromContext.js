/**
 * Resolves a string like "scope.sortedListingsIds" from the context.
 *
 * @param {string} string- Dot-separated path to resolve
 * @param {Object} context - Object to resolve the path from
 * @returns {*} - The resolved value from the context
 */
export default function resolveStringFromContext(string, context) {
  return string.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") {
      return acc[key];
    }
    return undefined;
  }, context);
}
