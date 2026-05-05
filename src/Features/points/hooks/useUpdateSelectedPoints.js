import { useSelector } from "react-redux";

import {
  selectSelectedItems,
  selectSelectedPointIds,
} from "Features/selection/selectionSlice";

import db from "App/db/db";

// Applies a partial update (e.g. {type:"circle"} or {offsetBottom:1.5}) to every
// selected point inside the parent annotation. Walks both the outer contour
// (annotation.points) and every cut ring (annotation.cuts[i].points), then
// writes back via a single db.annotations.update.
export default function useUpdateSelectedPoints() {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const selectedPointIds = useSelector(selectSelectedPointIds);

  return async (partial) => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    if (!annotationId || !selectedPointIds?.length || !partial) return;

    const annotation = await db.annotations.get(annotationId);
    if (!annotation) return;

    const idSet = new Set(selectedPointIds);
    const remap = (pts) =>
      (pts || []).map((p) => (idSet.has(p.id) ? { ...p, ...partial } : p));

    const updates = { points: remap(annotation.points) };
    if (annotation.cuts) {
      updates.cuts = annotation.cuts.map((c) => ({ ...c, points: remap(c.points) }));
    }
    if (annotation.innerPoints) {
      updates.innerPoints = remap(annotation.innerPoints);
    }

    await db.annotations.update(annotationId, updates);
  };
}
