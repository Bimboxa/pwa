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
// - `labelOffset`: number of mailles already numbered before this set in the
//   listing, so labels continue the per-listing sequence (M1, M2, M3…).
// - `labelPrefix`: label prefix, default "M" (maille).
//
// Cells are returned in reading order (rows top→bottom, then left→right inside a
// row) so the M-numbers read intuitively on screen.
//
// Returns [{ id, label, points:[{x,y}], areaPx, areaM2, centroid }].
export default function computeMeshCells(
  outlinePoints,
  meshLines,
  { meterByPx, labelOffset = 0, labelPrefix = "M" } = {}
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

  const mapped = cells.map((normPoints) => {
    const points = normPoints.map(fromNorm);
    const areaPx = polygonAreaPx(points);
    return {
      points,
      areaPx,
      areaM2: meterByPx ? areaPx * meterByPx * meterByPx : null,
      centroid: polygonCentroid(points),
    };
  });

  // reading order: group cells into rows by centroid Y (tolerance = a fraction
  // of the outline height), then sort each row left→right.
  const rowTol = (bbox.maxY - bbox.minY || 1) * 0.12;
  const rows = [];
  for (const cell of [...mapped].sort((a, b) => a.centroid.y - b.centroid.y)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(cell.centroid.y - row.y0) <= rowTol)
      row.cells.push(cell);
    else rows.push({ y0: cell.centroid.y, cells: [cell] });
  }
  rows.forEach((r) => r.cells.sort((a, b) => a.centroid.x - b.centroid.x));
  const ordered = rows.flatMap((r) => r.cells);

  return ordered.map((cell, i) => ({
    id: `cell-${i}`,
    label: `${labelPrefix}${labelOffset + i + 1}`,
    ...cell,
  }));
}
