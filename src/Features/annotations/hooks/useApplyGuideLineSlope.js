import db from "App/db/db";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import applyGuideLineSlopeOffsets from "Features/annotations/utils/applyGuideLineSlopeOffsets";

// Applies a uniform slope (%) along the guideLine of the selected annotation:
// recomputes each vertex's `offsetTop` from its arc-length projection onto the
// guideLine and persists it inline on every ring (main contour + cuts + inner
// points), together with the authoritative `guideLineSlopePct`.
//
// The whole 3D / quantity pipeline reads `offsetTop`, so writing it here is all
// that is needed for the object to tilt and the developed surface/perimeter to
// update.
export default function useApplyGuideLineSlope() {
  const annotation = useSelectedAnnotation();
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;

  return async (slopePct) => {
    if (!annotation?.id) return;
    if (!Array.isArray(annotation.guideLine) || annotation.guideLine.length < 2) {
      return;
    }

    // All ring vertices in pixel space (resolved annotation).
    const vertices = [
      ...(annotation.points || []),
      ...((annotation.cuts || []).flatMap((c) => c?.points || [])),
      ...(annotation.innerPoints || []),
    ].filter((p) => p && p.id != null && typeof p.x === "number");

    const offsetMap = applyGuideLineSlopeOffsets({
      guidePts: annotation.guideLine,
      vertices,
      meterByPx,
      slopePct,
    });
    if (offsetMap.size === 0) return;

    // Write back on the raw (stored) annotation: offsetTop lives inline on the
    // point refs, so we only patch offsetTop by matching ids and leave x/y
    // (held in db.points) untouched.
    const raw = await db.annotations.get(annotation.id);
    if (!raw) return;

    const applyRing = (ring) =>
      (ring || []).map((p) =>
        offsetMap.has(p?.id) ? { ...p, offsetTop: offsetMap.get(p.id) } : p
      );

    const update = {
      points: applyRing(raw.points),
      guideLineSlopePct: Number(slopePct) || 0,
    };
    if (Array.isArray(raw.cuts)) {
      update.cuts = raw.cuts.map((c) => ({ ...c, points: applyRing(c?.points) }));
    }
    if (Array.isArray(raw.innerPoints)) {
      update.innerPoints = applyRing(raw.innerPoints);
    }

    await db.annotations.update(annotation.id, update);
  };
}
