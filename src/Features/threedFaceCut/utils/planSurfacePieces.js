// Numbering of the pieces of a surface host (applySurfaceCuts): every SOLID
// mesh of the host is a piece from the first build — a source no cut reached
// is one piece in its own right, a source a cut touched is replaced by its
// kept pieces, a removed source with nothing left is dropped. One counter
// runs over the sources in order, so the indices are unique, ordered by
// source, and deterministic between two identical builds.
//
// pieces: the result of applySurfaceCutsToSoups (`{sourceIndex, touched,
// removed}` entries), or nothing when the host has no cut.
//
// Returns one entry per source:
//   { kind: "KEEP", index }                         tagged in place
//   { kind: "REPLACE", pieces: [{ piece, index }] } replaced by these pieces
//   { kind: "DROP" }                                taken down, no index
//
// Pure (no three.js): node-testable.

export const SURFACE_PIECE_KEEP = "KEEP";
export const SURFACE_PIECE_REPLACE = "REPLACE";
export const SURFACE_PIECE_DROP = "DROP";

export default function planSurfacePieces(sourceCount, pieces) {
  const plan = [];
  let index = 0;
  for (let sourceIndex = 0; sourceIndex < sourceCount; sourceIndex++) {
    const all = (pieces || []).filter((p) => p?.sourceIndex === sourceIndex);
    if (!all.some((p) => p.touched || p.removed)) {
      plan.push({ kind: SURFACE_PIECE_KEEP, index: index++ });
      continue;
    }
    const kept = all.filter((p) => !p.removed);
    if (!kept.length) {
      plan.push({ kind: SURFACE_PIECE_DROP });
      continue;
    }
    plan.push({
      kind: SURFACE_PIECE_REPLACE,
      pieces: kept.map((piece) => ({ piece, index: index++ })),
    });
  }
  return plan;
}
