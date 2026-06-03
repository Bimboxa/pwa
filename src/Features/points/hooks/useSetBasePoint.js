import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import db from "App/db/db";

// Sets (or clears) the `isBasePoint` flag on a single point of the selected
// annotation. The flag is EXCLUSIVE: it is cleared on every other point first,
// then set on `pointId` when `value` is true. Walks the outer contour, every
// cut ring, inner points and guide lines (mirrors useUpdateSelectedPoints), so
// the previous base point is always unset wherever it lived.
//
// The base point is used as the anchor of the profile extrusion
// (see useProfileResolution).
export default function useSetBasePoint() {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];

  return async (pointId, value) => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    if (!annotationId || !pointId) return;

    const annotation = await db.annotations.get(annotationId);
    if (!annotation) return;

    const remap = (pts) =>
      (pts || []).map((p) => ({
        ...p,
        isBasePoint: value && p.id === pointId,
      }));

    const updates = { points: remap(annotation.points) };
    if (annotation.cuts) {
      updates.cuts = annotation.cuts.map((c) => ({
        ...c,
        points: remap(c.points),
      }));
    }
    if (annotation.innerPoints) {
      updates.innerPoints = remap(annotation.innerPoints);
    }
    if (Array.isArray(annotation.guideLines)) {
      // guideLine refs key on `pointId` (not `id`).
      updates.guideLines = annotation.guideLines.map((gl) => ({
        ...gl,
        points: (gl?.points || []).map((g) => ({
          ...g,
          isBasePoint: value && g.pointId === pointId,
        })),
      }));
    }

    await db.annotations.update(annotationId, updates);
  };
}
