import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";

// Index of the piece of a clipFaceByCutLines result holding `point` (world),
// holes excluded; -1 when none. Cheap enough to run on every pointer move
// (the clip itself is cached by the caller).
export default function findCutPieceAt(clip, point) {
  if (!clip?.pieces?.length || !clip.basis || !point) return -1;
  const p2 = projectPointTo2d(point, clip.basis);
  return clip.pieces.findIndex((piece) => {
    const contour2d = piece.contour.map((p) => projectPointTo2d(p, clip.basis));
    if (!pointInPolygon2d(p2, contour2d)) return false;
    return !(piece.holes || []).some((hole) =>
      pointInPolygon2d(
        p2,
        hole.map((p) => projectPointTo2d(p, clip.basis))
      )
    );
  });
}
