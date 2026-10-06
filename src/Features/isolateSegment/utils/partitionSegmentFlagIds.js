// Per-segment flags (start point id arrays, see
// annotations/utils/segmentFlags.js) split over the pieces of an isolated
// segment. A segment belongs to the piece that holds its start point
// anywhere but at the piece's LAST slot (an open piece carries no segment
// from its last point). Pure, node-testable.
//
// flagIdsByField: { [idField]: ids[] } of the original (already materialized
// as ids); rawPoints: the original refs; pieces: { [key]: { indices } | null }
// (from isolatePolylineSegment). Returns { [key]: { [idField]: ids[] } }
// (every field present on every existing piece, possibly empty).
export default function partitionSegmentFlagIds(
  flagIdsByField,
  rawPoints,
  pieces
) {
  const posById = new Map();
  (rawPoints || []).forEach((p, i) => {
    if (p?.id && !posById.has(p.id)) posById.set(p.id, i);
  });

  const out = {};
  for (const [key, piece] of Object.entries(pieces || {})) {
    if (!piece) continue;
    const owned = new Set(piece.indices.slice(0, -1));
    const fields = {};
    for (const [field, ids] of Object.entries(flagIdsByField || {})) {
      fields[field] = (ids || []).filter((id) => owned.has(posById.get(id)));
    }
    out[key] = fields;
  }
  return out;
}
