// Verbatim ports of Krnet src/utils/incrementalNaming.js and
// src/utils/autoCode.js — the automatic codification of an object from its
// nomenclature category: `<categoryCode><suffix>`, suffix incremented from
// the peers of the same category. Pure module.

// Extracts the last number found in a string along with its position and
// zero-padding info. Returns { prefix, number, suffix, padLength } or null.
function parseNameNumber(name) {
  const matches = [...String(name).matchAll(/\d+/g)];
  if (matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1];
  const numStr = lastMatch[0];
  const index = lastMatch.index;
  return {
    prefix: name.substring(0, index),
    number: parseInt(numStr, 10),
    suffix: name.substring(index + numStr.length),
    padLength: numStr.length,
  };
}

// Next incremental name from the existing ones. firstName is returned when
// nothing exists yet; otherwise the highest number found is incremented,
// keeping the pattern (prefix / padding / suffix) of that name.
export function getNextIncrementalName(existingNames, firstName = null) {
  if (!existingNames || existingNames.length === 0) {
    return firstName || null;
  }
  let bestParsed = null;
  let highestNumber = -1;
  for (const name of existingNames) {
    const parsed = parseNameNumber(name);
    if (parsed && parsed.number > highestNumber) {
      highestNumber = parsed.number;
      bestParsed = parsed;
    }
  }
  if (!bestParsed) {
    if (firstName) {
      const firstParsed = parseNameNumber(firstName);
      if (firstParsed) {
        const nextNum = existingNames.length + firstParsed.number;
        const padded = String(nextNum).padStart(firstParsed.padLength, "0");
        return firstParsed.prefix + padded + firstParsed.suffix;
      }
    }
    return null;
  }
  const nextNum = highestNumber + 1;
  const padded = String(nextNum).padStart(bestParsed.padLength, "0");
  return bestParsed.prefix + padded + bestParsed.suffix;
}

// Rules (Krnet):
// - autoCode disabled → null
// - category without a `code` (tree containers) → null
// - otherwise `<categoryCode><suffix>` incremented over the peers of the
//   listing whose code starts with the category code.
export function computeAutoCode({ autoCode, categoryEntity, listingPeers }) {
  if (!autoCode || !autoCode.enabled) return null;
  if (!categoryEntity || !categoryEntity.code) return null;
  const prefix = categoryEntity.code;
  const firstFull = `${prefix}${autoCode.firstSuffix}`;
  const peerCodes = (listingPeers || [])
    .map((e) => e?.code)
    .filter((c) => typeof c === "string" && c.startsWith(prefix));
  if (peerCodes.length === 0) return firstFull;
  return getNextIncrementalName(peerCodes, firstFull);
}
