import { Box, List, Tooltip } from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";
import PushPin from "@mui/icons-material/PushPin";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import RowConfig from "./RowItemConfig";

// Handle slot of a row (drag handle or pin), left of the item icon.
const HANDLE_SX = {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  color: "text.disabled",
};

// Fixed row of a pinned item: same layout as the sortable rows, with a pin
// icon in place of the drag handle — the band hoists these keys whatever the
// stored order, so letting them be dragged would persist an order the band
// ignores. Pinned does not mean locked: a pinned row still toggles.
function FixedRowConfig({ item, onToggle, onOpenSettings }) {
  const handle = (
    <Tooltip title={item.pinTooltip ?? ""} placement="right">
      <Box component="span" sx={HANDLE_SX}>
        <PushPin sx={{ fontSize: 16 }} />
      </Box>
    </Tooltip>
  );
  return (
    <RowConfig
      item={item}
      onToggle={onToggle}
      onOpenSettings={onOpenSettings}
      handle={handle}
    />
  );
}

// Draggable row.
function SortableRowConfig({ item, onToggle, onOpenSettings }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const handle = (
    <Box
      component="span"
      {...attributes}
      {...listeners}
      // the handle sits INSIDE the row button: a plain click on it (a drag
      // that moved less than the sensor's activation distance, or the click
      // closing a real drag) must not toggle the item
      onClick={(e) => e.stopPropagation()}
      sx={{
        ...HANDLE_SX,
        cursor: "grab",
        touchAction: "none",
        "&:active": { cursor: "grabbing" },
      }}
    >
      <DragIndicator sx={{ fontSize: 18 }} />
    </Box>
  );

  return (
    <RowConfig
      item={item}
      onToggle={onToggle}
      onOpenSettings={onOpenSettings}
      handle={handle}
      rowRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
    />
  );
}

// Shared list of the "Modules & outils" page, used by both the Modules and
// the Outils sections: one row per item, drag handle + icon + label on the
// left, settings shortcut + activation switch on the right, the whole row
// clickable.
//
// `items` are already in band order; each one carries
// {key, icon, label, caption, checked, switchDisabled, switchTooltip} plus
// an optional `pin` ("top" | "bottom") for the entries the band anchors by
// itself. Pinned rows are fixed and excluded from the persisted order — the
// sort utils hoist them anyway, and an unknown key lands at the end of its
// own band section.
//
// `onOrderChange` receives the full ordered list of draggable keys, rebuilt
// from the live catalog on every drag (which also purges stale keys).
export default function ListSortableSwitchConfig({
  items,
  onToggle,
  onOpenSettings,
  onOrderChange,
}) {
  // A distance constraint (not the 250 ms press delay of useDndSensors): the
  // rows have a dedicated handle, so a drag can start right away.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // helpers

  const pinnedTop = items.filter((i) => i.pin === "top");
  const sortable = items.filter((i) => !i.pin);
  const pinnedBottom = items.filter((i) => i.pin === "bottom");
  const ids = sortable.map((i) => i.key);

  // handlers

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from === -1 || to === -1) return;
    onOrderChange(arrayMove(ids, from, to));
  }

  // render

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <List disablePadding>
          {pinnedTop.map((i) => (
            <FixedRowConfig
              key={i.key}
              item={i}
              onToggle={onToggle}
              onOpenSettings={onOpenSettings}
            />
          ))}
          {sortable.map((i) => (
            <SortableRowConfig
              key={i.key}
              item={i}
              onToggle={onToggle}
              onOpenSettings={onOpenSettings}
            />
          ))}
          {pinnedBottom.map((i) => (
            <FixedRowConfig
              key={i.key}
              item={i}
              onToggle={onToggle}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
}
