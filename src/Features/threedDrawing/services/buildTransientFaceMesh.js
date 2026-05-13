import db from "App/db/db";

import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";

// Loads the annotation + its db.points and returns a snapshot suitable for
// repeated transient mesh regeneration during the gizmo drag.
//
//   {
//     annotation: db record,
//     pointsById: Map<id, {x, y}>,   // normalized [0..1]
//     baseMap: BaseMap or fallback record,
//     baseMapForRender: { imageWidth, imageHeight, meterByPx },
//   }
export async function loadAnnotationSnapshot(annotationId) {
  const ann = await db.annotations.get(annotationId);
  if (!ann) return null;
  const pointIds = (ann.points || []).map((p) => p.id).filter(Boolean);
  const points = await db.points.bulkGet(pointIds);
  const pointsById = new Map();
  for (const p of points) {
    if (p) pointsById.set(p.id, { x: p.x, y: p.y });
  }
  const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
  if (!baseMapRecord) return null;
  const baseMapForRender = {
    imageWidth: baseMapRecord.image?.imageSize?.width || 1,
    imageHeight: baseMapRecord.image?.imageSize?.height || 1,
    meterByPx: baseMapRecord.meterByPx || 0.01,
  };
  return { annotation: ann, pointsById, baseMapRecord, baseMapForRender };
}

// Build a transient Three.js Group for `snapshot.annotation` with the delta
// applied. Two modes:
//   - mode = "WHOLE": every point shifts (used for the moved annotation
//     itself, except we usually skip this and just shift mesh.position)
//   - mode = "SHARED_ONLY": only refs whose id is in `sharedIds` shift; the
//     XY via the per-id override and the Z via per-vertex `offsetTop`. The
//     annotation's `offsetZ` is left untouched so the non-shared corners
//     stay put.
//
// The result must be added by the caller to the original mesh's parent so
// the baseMap-group transform applies correctly.
export function buildTransientFaceMesh({
  snapshot,
  sharedIds,
  deltaLocal, // {x, y, z} in baseMap-local meters
  mode,
  // Optional in SHARED_ONLY mode: a Map<pointId, "BOTTOM" | "TOP" | null>
  // that overrides the default "always shift offsetTop" behaviour per shared
  // corner. Used by the move gizmo when shifting a POLYGON face propagates
  // to connected POLYLINE walls: "BOTTOM" -> shift offsetBottom (wall above
  // the polygon, rests on floor); "TOP" -> shift offsetTop (wall below the
  // polygon, reaches up to ceiling); null -> the wall straddles the polygon
  // level, leave it alone.
  fieldByPointId,
}) {
  if (!snapshot) return null;
  const { annotation, pointsById, baseMapForRender } = snapshot;
  const { imageWidth, imageHeight, meterByPx } = baseMapForRender;
  if (!imageWidth || !imageHeight || !meterByPx) return null;

  const dxNorm = deltaLocal.x / (meterByPx * imageWidth);
  const dyNorm = -deltaLocal.y / (meterByPx * imageHeight);
  const dz = deltaLocal.z;

  // Modified normalized point map (only the refs we want to shift).
  const overridePts = new Map(pointsById);
  let nextOffsetZ = annotation.offsetZ ?? 0;
  let nextRefs = annotation.points || [];

  if (mode === "WHOLE") {
    for (const ref of nextRefs) {
      const src = pointsById.get(ref.id);
      if (!src) continue;
      overridePts.set(ref.id, { x: src.x + dxNorm, y: src.y + dyNorm });
    }
    nextOffsetZ += dz;
  } else if (mode === "SHARED_ONLY") {
    nextRefs = nextRefs.map((ref) => {
      if (!sharedIds.has(ref.id)) return ref;
      if (fieldByPointId) {
        const which = fieldByPointId.get(ref.id);
        if (which === "BOTTOM") {
          return { ...ref, offsetBottom: (ref.offsetBottom ?? 0) + dz };
        }
        if (which === "TOP") {
          return { ...ref, offsetTop: (ref.offsetTop ?? 0) + dz };
        }
        return ref;
      }
      return { ...ref, offsetTop: (ref.offsetTop ?? 0) + dz };
    });
    for (const id of sharedIds) {
      if (fieldByPointId && fieldByPointId.get(id) == null) continue;
      const src = pointsById.get(id);
      if (!src) continue;
      overridePts.set(id, { x: src.x + dxNorm, y: src.y + dyNorm });
    }
  }

  // Resolve refs into pixel-space {x, y} so createAnnotationObject3D /
  // pointsToLocal can do the rest of the math unchanged.
  const resolvedPoints = nextRefs.map((ref) => {
    const src = overridePts.get(ref.id);
    if (!src) return ref;
    return {
      ...ref,
      x: src.x * imageWidth,
      y: src.y * imageHeight,
    };
  });

  const transientAnnotation = {
    ...annotation,
    points: resolvedPoints,
    offsetZ: nextOffsetZ,
  };

  return createAnnotationObject3D(transientAnnotation, baseMapForRender);
}
