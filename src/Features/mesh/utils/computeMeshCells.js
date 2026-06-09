import splitPolygonByPolyline from "Features/geometry/utils/splitPolygonByPolyline";

import { getBbox, polygonAreaPx, polygonCentroid } from "./meshGeometry";

// Subdivide an outline polygon into mesh cells by folding each cut line over the
// current set of cells (guillotine model): a line splits every cell it fully
// crosses into two pieces, leaving the rest untouched.
//
// splitPolygonByPolyline operates in normalized [0..1]-ish space (its internal
// EXTEND_DISTANCE / OFFSET_DISTANCE = 10 only behave as a half-plane at unit
// scale), so the outline + cut lines are scaled into a unit box around the
// bbox before splitting, then scaled back. Areas are computed on the original
// (pixel) geometry.
//
// - `outlinePoints`: [{x, y, id?}] closed polygon (no explicit closing point),
//   in editor world space.
// - `meshLines`: [{orientation, p1, p2}] cut lines in the same world space.
// - `meterByPx`: scale to convert pixel² areas into m² (optional).
//
// Returns [{ id, points:[{x,y}], areaPx, areaM2, centroid }].
export default function computeMeshCells(
  outlinePoints,
  meshLines,
  { meterByPx } = {}
) {
  if (!outlinePoints || outlinePoints.length < 3) return [];

  const bbox = getBbox(outlinePoints);
  const ox = bbox.minX;
  const oy = bbox.minY;
  const scale =
    1 / (Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) || 1);

  const toNorm = (p) => ({ x: (p.x - ox) * scale, y: (p.y - oy) * scale });
  const fromNorm = (p) => ({ x: p.x / scale + ox, y: p.y / scale + oy });

  // initial single cell = the whole outline (normalized; ids preserved)
  let cells = [
    outlinePoints.map((p, i) => ({
      id: p.id ?? `outline-${i}`,
      ...toNorm(p),
    })),
  ];

  for (const line of meshLines ?? []) {
    if (!line?.p1 || !line?.p2) continue;
    // 2-point cut; splitPolygonByPolyline extends it internally (≫ unit box)
    const cutting = [toNorm(line.p1), toNorm(line.p2)];
    const next = [];
    for (const cell of cells) {
      const res = splitPolygonByPolyline(cell, cutting);
      if (res && res.piece1?.length >= 3 && res.piece2?.length >= 3) {
        next.push(res.piece1, res.piece2);
      } else {
        next.push(cell);
      }
    }
    cells = next;
  }

  return cells.map((normPoints, i) => {
    const points = normPoints.map(fromNorm);
    const areaPx = polygonAreaPx(points);
    return {
      id: `cell-${i}`,
      points,
      areaPx,
      areaM2: meterByPx ? areaPx * meterByPx * meterByPx : null,
      centroid: polygonCentroid(points),
    };
  });
}
