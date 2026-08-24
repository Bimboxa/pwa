import { useCallback } from "react";

import { generateKeyBetween } from "fractional-indexing";

import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";

// ---------------------------------------------------------------------------
// useReorderAnnotationTemplates — dnd-kit drag-end handler persisting a new
// fractional orderIndex on the reordered templates. Handles within-group
// reorders and cross-group moves (the whole groupLabel block moves together).
// Shared by PopperMapListings' AnnotationTemplatesForListing and the Dessin
// left panel list.
// ---------------------------------------------------------------------------

export default function useReorderAnnotationTemplates() {
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  return useCallback(
    async (event, annotationTemplates) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !annotationTemplates?.length)
        return;

      const sortableIds = annotationTemplates.map((t) => t.id);
      const oldIndex = sortableIds.indexOf(active.id);
      const newIndex = sortableIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const normalizeGroup = (g) =>
        (g ?? "").trim().toUpperCase().replace(/\s+/g, "");

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
        const adjustedNewIndex = newOrder.findIndex((t) => t.id === over.id);
        newOrder.splice(adjustedNewIndex, 0, draggedTemplate);
      } else {
        // Cross-group: move all group members together
        const groupMembers = draggedGroup
          ? annotationTemplates.filter(
              (t) => normalizeGroup(t.groupLabel) === draggedGroup
            )
          : [draggedTemplate];

        const remaining = annotationTemplates.filter(
          (t) => !groupMembers.some((m) => m.id === t.id)
        );

        const overInRemaining = remaining.findIndex((t) => t.id === over.id);
        const insertAt =
          overInRemaining === -1 ? remaining.length : overInRemaining;

        newOrder = [...remaining];
        newOrder.splice(insertAt, 0, ...groupMembers);
      }

      // Assign new orderIndex values using fractional indexing
      let lastIndex = null;
      for (const template of newOrder) {
        const newOrderIndex = generateKeyBetween(lastIndex, null);
        lastIndex = newOrderIndex;
        if (template.orderIndex !== newOrderIndex) {
          await updateAnnotationTemplate({
            ...template,
            orderIndex: newOrderIndex,
          });
        }
      }
    },
    [updateAnnotationTemplate]
  );
}
