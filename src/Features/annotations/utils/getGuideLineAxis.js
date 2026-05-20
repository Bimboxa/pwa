import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

// Builds the ramp axis from a drawn guideLine.
//
// Inputs (all in pixel space):
//   - guidePts: resolved guideLine points [{x,y,type?}] (open polyline; arc
//     control points expanded here)
//   - polygonPts: the polygon ring vertices [{id,x,y}]
//
// Returns:
//   {
//     polyline: [{x,y}]          // arc-expanded guideLine in pixels
//     L2D: number                // total 2D length (pixels)
//     sById: Map<pointId, s>     // arc-length of each vertex's projection
//   }
// or null when the guideLine is degenerate.
//
// `s` increases from the guideLine's first point (s=0) to its last (s=L2D);
// iso-height contours are the constant-`s` loci, transverse to the path.
const ARC_SAMPLES = 16;

export default function getGuideLineAxis({ guidePts, polygonPts }) {
  if (!Array.isArray(guidePts) || guidePts.length < 2) return null;

  const polyline = expandArcsInPath(guidePts, ARC_SAMPLES, false).map((p) => ({
    x: p.x,
    y: p.y,
  }));
  if (polyline.length < 2) return null;

  let L2D = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    L2D += Math.hypot(
      polyline[i + 1].x - polyline[i].x,
      polyline[i + 1].y - polyline[i].y
    );
  }
  if (!Number.isFinite(L2D) || L2D < 1e-6) return null;

  const sById = new Map();
  for (const v of polygonPts || []) {
    if (!v?.id || typeof v.x !== "number" || typeof v.y !== "number") continue;
    const proj = projectPointOnPolyline(v, polyline);
    if (proj) sById.set(v.id, proj.s);
  }
  if (sById.size === 0) return null;

  return { polyline, L2D, sById };
}
