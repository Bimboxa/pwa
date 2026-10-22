// Stable key of a RULER (dimension chain) segment, used to store per-segment
// data on the annotation row — `rulerLabelOffsets` (the displacement of a
// segment's value card from its default position, base-map-local metres).
//
// Keyed by the point ids of the segment's ends, not by its index (project
// convention since the segment-flags migration: an index breaks on point
// insert / delete). `"<startId>|<endId>"` — a riser (A, A, Q: two refs to
// one point at different altitudes) gives `A|A` and `A|Q` without any
// counter, and the key self-invalidates when either end changes. The same
// ordered pair occurring again later in the chain gets a `#<n>` suffix.
//
// Dependency free so it runs under `node --test`.

export function getRulerSegmentKey(startId, endId, occurrence = 0) {
  const base = `${startId ?? ""}|${endId ?? ""}`;
  return occurrence > 0 ? `${base}#${occurrence}` : base;
}

// Keys of the segments of `points` (raw refs or resolved points, both carry
// `id`), aligned with segment index i = points[i] → points[i + 1].
export function getRulerSegmentKeys(points) {
  const seen = new Map();
  const keys = [];
  for (let i = 0; i < (points?.length ?? 0) - 1; i++) {
    const base = getRulerSegmentKey(points[i]?.id, points[i + 1]?.id);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    keys.push(n > 0 ? `${base}#${n}` : base);
  }
  return keys;
}

// Below 1 mm a label offset is "none".
const ZERO_OFFSET_M = 1e-3;

export function isZeroLabelOffset(v) {
  if (!v) return true;
  return Math.hypot(v.x || 0, v.y || 0, v.z || 0) < ZERO_OFFSET_M;
}

// True when at least one value card of the ruler is displaced: an offset
// stored under a key that still matches a segment, with a non-zero vector.
// Orphan keys (a point was deleted / replaced) are ignored.
export function hasActiveRulerLabelOffsets(annotation) {
  const offsets = annotation?.rulerLabelOffsets;
  if (!offsets || typeof offsets !== "object") return false;
  const keys = new Set(getRulerSegmentKeys(annotation.points || []));
  return Object.entries(offsets).some(
    ([key, v]) => keys.has(key) && !isZeroLabelOffset(v)
  );
}

// Offsets of a ruler whose points were re-minted index for index (paste,
// duplicate): the same displacement under the new keys. Null when the arrays
// don't line up or nothing remains.
export function remapRulerLabelOffsets(offsets, oldPoints, newPoints) {
  if (!offsets || typeof offsets !== "object") return null;
  const oldKeys = getRulerSegmentKeys(oldPoints || []);
  const newKeys = getRulerSegmentKeys(newPoints || []);
  if (!oldKeys.length || oldKeys.length !== newKeys.length) return null;
  const out = {};
  oldKeys.forEach((key, i) => {
    const v = offsets[key];
    if (v && !isZeroLabelOffset(v)) out[newKeys[i]] = v;
  });
  return Object.keys(out).length ? out : null;
}
