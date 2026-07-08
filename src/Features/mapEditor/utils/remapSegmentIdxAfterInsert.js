/**
 * Remap segment-indexed values (hiddenSegmentsIdx & siblings) after point refs
 * were inserted into a path (segment i = points[i] → points[i+1], closing
 * segment = n-1 on closed rings).
 *
 * Works by ref identity: every surviving ref keeps its id, so an old segment j
 * maps to ALL the new sub-segments lying between its old start ref and its old
 * end ref (an insertion inside a flagged segment flags both halves — hiding
 * half a formerly hidden segment would make it reappear).
 *
 * @param {Array<{id: string}>} oldPoints - refs before insertion
 * @param {Array<{id: string}>} newPoints - refs after insertion
 * @param {number[]} idxArray - segment indices relative to oldPoints
 * @param {{closed?: boolean}} [options]
 * @returns {number[]} segment indices relative to newPoints, sorted
 */
export default function remapSegmentIdxAfterInsert(
  oldPoints,
  newPoints,
  idxArray,
  { closed = false } = {}
) {
  if (!Array.isArray(idxArray) || idxArray.length === 0) return [];

  const posById = new Map();
  newPoints.forEach((p, i) => {
    if (!posById.has(p.id)) posById.set(p.id, i);
  });

  const n = oldPoints.length;
  const m = newPoints.length;
  const oldSegmentCount = closed ? n : n - 1;

  const out = new Set();
  for (const j of idxArray) {
    if (!Number.isInteger(j) || j < 0 || j >= oldSegmentCount) continue;
    const startNew = posById.get(oldPoints[j].id);
    const endNew = posById.get(oldPoints[(j + 1) % n].id);
    if (startNew == null || endNew == null) continue;

    let k = startNew;
    let guard = 0;
    while (k !== endNew && guard++ <= m) {
      out.add(k);
      k = (k + 1) % m;
    }
  }

  return [...out].sort((a, b) => a - b);
}
