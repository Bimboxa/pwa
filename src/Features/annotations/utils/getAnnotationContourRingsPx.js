import db from "App/db/db";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

const ARC_SAMPLES = 16;

// Resolves a RAW annotation's contour rings (main + cuts) to pixel space,
// arc-expanded — the geometry needed to project a point onto the contour.
// Reads the referenced db.points (normalized [0..1]) and scales by imageSize.
export async function getAnnotationContourRingsPx(ann, imageSize) {
  const ringRefs = [
    ann?.points || [],
    ...(ann?.cuts || []).map((c) => c?.points || []),
  ];
  const allIds = ringRefs.flat().map((r) => r?.id).filter(Boolean);
  const rows = await db.points.bulkGet(allIds);
  const rowById = new Map(rows.filter(Boolean).map((r) => [r.id, r]));
  return ringRefs
    .map((refs) =>
      refs
        .map((r) => {
          const row = rowById.get(r?.id);
          if (!row || !Number.isFinite(row.x) || !Number.isFinite(row.y)) {
            return null;
          }
          return {
            x: row.x * imageSize.width,
            y: row.y * imageSize.height,
            ...(r?.type ? { type: r.type } : {}),
          };
        })
        .filter(Boolean)
    )
    .filter((ring) => ring.length >= 3);
}

// Projects a pixel point onto the closest contour ring (closed loops, arcs
// expanded). Returns the projected point when within `tolPx`, else the input.
export function projectPointOnContourRings(p, rings, tolPx) {
  let best = null;
  for (const ring of rings) {
    const poly = expandArcsInPath(ring, ARC_SAMPLES, true).filter(
      (q) => Number.isFinite(q?.x) && Number.isFinite(q?.y)
    );
    if (poly.length < 2) continue;
    const closed = [...poly, poly[0]];
    const proj = projectPointOnPolyline(p, closed);
    if (proj && (!best || proj.distance < best.distance)) best = proj;
  }
  if (best && best.distance <= tolPx) return best.projected;
  return p;
}
