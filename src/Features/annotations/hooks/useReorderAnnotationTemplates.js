import { useCallback } from "react";
import { useDispatch } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";

import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// useReorderAnnotationTemplates — dnd-kit drag-end handler persisting a new
// fractional orderIndex on the reordered templates. Handles within-group
// reorders and cross-group moves (the whole groupLabel block moves together).
// Follows dnd-kit's arrayMove semantics: moving down drops the item AFTER
// `over`, moving up drops it BEFORE `over`.
// All orderIndex writes go through one Dexie transaction and a single
// dispatch, so the live queries recompute once per drop.
// Shared by PopperMapListings' AnnotationTemplatesForListing and the Dessin
// left panel list.
// ---------------------------------------------------------------------------

const normalizeGroup = (g) =>
  (g ?? "").trim().toUpperCase().replace(/\s+/g, "");

export default function useReorderAnnotationTemplates() {
  const dispatch = useDispatch();

  return useCallback(
    async (event, annotationTemplates) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !annotationTemplates?.length)
        return;

      const sortableIds = annotationTemplates.map((t) => t.id);
      const oldIndex = sortableIds.indexOf(active.id);
      const newIndex = sortableIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const movingDown = oldIndex < newIndex;

      const draggedTemplate = annotationTemplates[oldIndex];
      const overTemplate = annotationTemplates[newIndex];
      const draggedGroup = normalizeGroup(draggedTemplate?.groupLabel);
      const overGroup = normalizeGroup(overTemplate?.groupLabel);

      // Determine if this is a within-group reorder or a cross-group move
      const isWithinGroup = draggedGroup && draggedGroup === overGroup;

      let newOrder;
      if (isWithinGroup) {
        // Within-group: move just the dragged item within the list
        newOrder = [...annotationTemplates];
        newOrder.splice(oldIndex, 1);
        const overIndex = newOrder.findIndex((t) => t.id === over.id);
        newOrder.splice(overIndex + (movingDown ? 1 : 0), 0, draggedTemplate);
      } else {
        // Cross-group: move all group members together, around the whole
        // block of the target group (one item when `over` has no group).
        const groupMembers = draggedGroup
          ? annotationTemplates.filter(
              (t) => normalizeGroup(t.groupLabel) === draggedGroup
            )
          : [draggedTemplate];

        const remaining = annotationTemplates.filter(
          (t) => !groupMembers.some((m) => m.id === t.id)
        );

        const isOverBlock = (t) =>
          overGroup
            ? normalizeGroup(t.groupLabel) === overGroup
            : t.id === over.id;
        const firstIdx = remaining.findIndex(isOverBlock);
        const lastIdx = remaining.findLastIndex(isOverBlock);

        let insertAt;
        if (firstIdx === -1) insertAt = remaining.length;
        else insertAt = movingDown ? lastIdx + 1 : firstIdx;

        newOrder = [...remaining];
        newOrder.splice(insertAt, 0, ...groupMembers);
      }

      // Assign new orderIndex values using fractional indexing, collecting
      // only the templates whose key actually changes.
      const updates = [];
      let lastIndex = null;
      for (const template of newOrder) {
        const newOrderIndex = generateKeyBetween(lastIndex, null);
        lastIndex = newOrderIndex;
        if (template.orderIndex !== newOrderIndex) {
          updates.push({ id: template.id, orderIndex: newOrderIndex });
        }
      }
      if (updates.length === 0) return;

      await db.transaction("rw", db.annotationTemplates, async () => {
        await Promise.all(
          updates.map(({ id, orderIndex }) =>
            db.annotationTemplates.update(id, { orderIndex })
          )
        );
      });

      dispatch(triggerEntitiesTableUpdate("annotationTemplates"));
      dispatch(triggerAnnotationTemplatesUpdate());
    },
    [dispatch]
  );
}
