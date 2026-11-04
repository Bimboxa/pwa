import { polygonCentroid2d } from "./computeFaceArea.js";
import { liftLoopTo3d, liftPointTo3d } from "./planeProjection.js";
import {
  boundsOverlap,
  intersection,
  multiPolygonToLoops,
  rectMultiPolygon,
} from "./polygonBoolean2d.js";

// World pieces of an atlas rectangle (placeFixedAreaRect): the rectangle is
// intersected with the free region of every unfolded piece
// (computeFreePieces — borders and openings already removed, so an opening
// inside the rectangle becomes a HOLE of the piece and one straddling an
// edge a notch), mapped back to the piece's own plane (node.fromAtlas) and
// lifted to world coordinates.
//
// Returns { pieces: [{ contour, holes, normal, area, centroid, facetIndex,
// pieceIndex, cut: true }], area } — the pieces in the shape of
// clipRegionByCutLines' (buildMeshDataFromPieces, buildPiecesStippleOverlay)
// — or null when a boolean fails. Pure (no three.js), node-testable.
export default function liftFixedAreaRect({ rect, regions, nodes, pieces }) {
  const rectPolygon = rectMultiPolygon(rect);
  const diag = Math.hypot(rect.xMax - rect.xMin, rect.yMax - rect.yMin);
  const minArea = Math.max(1e-10, diag * diag * 1e-9);

  const out = [];
  let area = 0;
  for (const region of regions || []) {
    if (!region.free?.length || !boundsOverlap(region.bounds, rect)) continue;
    const node = nodes.get(region.pieceIndex);
    const piece = pieces[region.pieceIndex];
    if (!node || !piece) continue;
    const clipped = intersection(rectPolygon, region.free);
    if (!clipped) return null;
    for (const polygon of multiPolygonToLoops(clipped, { minArea })) {
      const contour2d = polygon.contour.map(node.fromAtlas);
      const holes2d = polygon.holes.map((hole) => hole.map(node.fromAtlas));
      out.push({
        contour: liftLoopTo3d(contour2d, node.basis),
        holes: holes2d.map((hole) => liftLoopTo3d(hole, node.basis)),
        normal: { ...piece.normal },
        area: polygon.area,
        centroid: liftPointTo3d(polygonCentroid2d(contour2d), node.basis),
        facetIndex: piece.facetIndex,
        pieceIndex: region.pieceIndex,
        cut: true,
      });
      area += polygon.area;
    }
  }
  return { pieces: out, area };
}
