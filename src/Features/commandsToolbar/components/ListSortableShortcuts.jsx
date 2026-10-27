import {
  Box,
  IconButton,
  List,
  ListItem,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";
import Close from "@mui/icons-material/Close";

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

// One draggable row of the shortcuts recap: handle + icon + label + remove.
function SortableRowShortcut({ command, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: command.key });

  const Icon = command.Icon;
  const renderedIcon = Icon ? <Icon /> : command.icon;

  return (
    <ListItem
      ref={setNodeRef}
      disableGutters
      disablePadding
      divider
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 0.5,
        py: 0.5,
        bgcolor: "background.paper",
        "&:last-of-type": { borderBottom: 0 },
      }}
    >
      <Box
        component="span"
        {...attributes}
        {...listeners}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          color: "text.disabled",
          cursor: "grab",
          touchAction: "none",
          "&:active": { cursor: "grabbing" },
        }}
      >
        <DragIndicator sx={{ fontSize: 18 }} />
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          color: "secondary.main",
          "& .MuiSvgIcon-root": { fontSize: 18 },
        }}
      >
        {renderedIcon}
      </Box>
      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {command.label}
      </Typography>
      <Tooltip title="Retirer du menu" placement="left">
        <IconButton size="small" onClick={() => onRemove(command.key)}>
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </ListItem>
  );
}

// Ordered recap of the right-click shortcuts (right column of the Raccourcis
// dialog): drag by the handle to reorder (`onOrderChange(keys)`), X to
// remove (`onRemove(key)`). `commands` are the registry commands in menu
// order. Same dnd-kit pattern as scopeConfig/ListSortableSwitchConfig.
export default function ListSortableShortcuts({
  commands,
  onOrderChange,
  onRemove,
}) {
  // A distance constraint: the rows have a dedicated handle, so a drag can
  // start right away.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // helpers

  const ids = commands.map((c) => c.key);

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
          {commands.map((command) => (
            <SortableRowShortcut
              key={command.key}
              command={command}
              onRemove={onRemove}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
}
