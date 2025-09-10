// ListItemsGeneric.jsx
import { useMemo, useState } from "react";
import { Box, List, ListItemButton, ListItemText } from "@mui/material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---- Sortable row that keeps MUI look & feel ----
function SortableRow({ id, selected, label, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // keep it above others while dragging
    zIndex: isDragging ? 1200 : "auto",
    // MUI already has hover/selected styles; we keep them
  };

  return (
    <ListItemButton
      divider
      selected={selected}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      // Ensure the element is a div (better with dnd-kit)
      component="div"
      sx={style}
    >
      <ListItemText>{label}</ListItemText>
    </ListItemButton>
  );
}

export default function ListItemsGenericVariantSortable({
  items,
  onClick,
  selection, // array of selected ids (strings)
  onSortEnd, // (newItemsArray) => void
}) {
  if (!items || items.length === 0) return <Box />;

  // Use a stable array of ids for dnd-kit
  const ids = useMemo(() => items.map((it) => it.id), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // small drag threshold so clicks still work nicely
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // For DragOverlay preview (optional)
  const [activeId, setActiveId] = useState(null);
  const activeItem = useMemo(
    () => items.find((it) => it.id === activeId),
    [items, activeId]
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    onSortEnd?.(newItems);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <List dense>
          {items.map((item) => {
            const id = item.id;
            const isSelected =
              Array.isArray(selection) && selection.includes(id); // keep compatibility

            return (
              <SortableRow
                key={id}
                id={id}
                selected={isSelected}
                label={item.label}
                onClick={() => onClick?.(item)}
              />
            );
          })}
        </List>
      </SortableContext>

      {/* Optional: a simple drag overlay that mirrors the row */}
      <DragOverlay>
        {activeItem ? (
          <ListItemButton
            divider
            selected
            component="div"
            sx={{ cursor: "grabbing" }}
          >
            <ListItemText>{activeItem.label}</ListItemText>
          </ListItemButton>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
