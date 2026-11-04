import buildShellFromRegion from "../../threedMesh/utils/buildShellFromRegion.js";
import coalesceCoplanarFaces from "../../threedMesh/utils/coalesceCoplanarFaces.js";
import { dot, length, scale, sub } from "../../threedMesh/utils/vec3Utils.js";
import triangulatePiece from "./triangulatePiece.js";

// Maille data of a GROUP of pieces (clipRegionByCutLines): the pieces of a
// region joined across its creases, in world coordinates.
//
// - one piece, or pieces that coalesce into ONE coplanar face → { faces }:
//   the historical polygon model (cut tools, splits, merges work on it);
// - otherwise → { shell }: the pieces triangulated into one surface, the
//   curved maille model (buildShellFromRegion).
//
// Before triangulating, the vertices one piece has on a crease are inserted
// into the neighbor piece's edge running along it: the two pieces were cut
// independently, so their shared crease carries different mid-edge vertices
// (T-junctions) — extractBoundaryLoops3d would keep those edges as borders
// and the shell would grow false inner loops.
//
// Returns null when nothing can be built.
export default function buildMeshDataFromPieces(
  pieces,
  { tolerance = 1e-3 } = {}
) {
  const valid = (pieces || []).filter(
    (p) => p?.contour?.length >= 3 && p.normal
  );
  if (!valid.length) return null;

  const faces = coalesceCoplanarFaces(
    valid.map((p) => ({
      contour: p.contour,
      holes: p.holes || [],
      normal: p.normal,
    }))
  );
  if (faces.length === 1) return { faces };

  const welded = insertCreaseVertices(valid, tolerance);
  const positions = [];
  for (const piece of welded) positions.push(...triangulatePiece(piece));
  if (!positions.length) return null;
  const shell = buildShellFromRegion({
    positions,
    index: null,
    tris: Array.from({ length: positions.length / 9 }, (_, i) => i),
  });
  return shell?.boundaries?.length ? { shell } : null;
}

// Copies of the pieces whose loops carry, on every edge, the vertices of the
// OTHER pieces lying strictly inside that edge.
function insertCreaseVertices(pieces, tolerance) {
  const others = pieces.map((_, i) =>
    pieces
      .filter((__, j) => j !== i)
      .flatMap((p) => [p.contour, ...(p.holes || [])].flat())
  );
  return pieces.map((piece, i) => ({
    ...piece,
    contour: insertIntoLoop(piece.contour, others[i], tolerance),
    holes: (piece.holes || []).map((hole) =>
      insertIntoLoop(hole, others[i], tolerance)
    ),
  }));
}

function insertIntoLoop(loop, candidates, tolerance) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    out.push(p);
    const d = sub(q, p);
    const len = length(d);
    if (len <= 2 * tolerance) continue;
    const dir = scale(d, 1 / len);
    const inserts = [];
    for (const c of candidates) {
      const s = dot(sub(c, p), dir);
      if (s <= tolerance || s >= len - tolerance) continue;
      const off = length(sub(sub(c, p), scale(dir, s)));
      if (off > tolerance) continue;
      if (inserts.some((ins) => Math.abs(ins.s - s) <= tolerance)) continue;
      inserts.push({ s, point: c });
    }
    inserts.sort((a, b) => a.s - b.s);
    for (const ins of inserts) out.push(ins.point);
  }
  return out;
}
