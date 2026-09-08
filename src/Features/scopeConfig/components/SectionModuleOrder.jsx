import { useSelector } from "react-redux";

import { LOCKED_MODULE_KEYS } from "Features/viewers/hooks/useViewers";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import { selectDisabledModuleKeys } from "../utils/scopeConfigSelectors";

import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import DragIndicator from "@mui/icons-material/DragIndicator";

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

// One row of the module order list: drag handle + module icon + label.
// Disabled modules stay in the list (dimmed) so their position is kept when
// they are re-enabled; locked modules are draggable like the others.
function SortableRowModuleOrder({ module, dimmed }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.key });

  return (
    <ListItem
      ref={setNodeRef}
      dense
      disableGutters
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : dimmed ? 0.45 : 1,
      }}
      sx={{
        gap: 1,
        px: 1,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: "background.paper",
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
      <ListItemIcon sx={{ minWidth: 32, "& svg": { fontSize: 20 } }}>
        {module.icon}
      </ListItemIcon>
      <ListItemText
        primary={module.label}
        primaryTypographyProps={{ variant: "body2", noWrap: true }}
      />
    </ListItem>
  );
}

// "Ordre des modules": the modules of the Configuration catalog (locked and
// disabled ones included, already in the scope order — useViewers applies
// scopeConfigs.moduleOrder on every path) as a sortable list. A drag
// persists the full ordered key list (useScopeConfigActions.setModuleOrder);
// the left band follows live. The bottom "Configuration" entry of the band
// is not a module and stays fixed.
export default function SectionModuleOrder({ modules }) {
  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const { setModuleOrder } = useScopeConfigActions();

  // A distance constraint (not the 250 ms press delay of useDndSensors): the
  // rows have a dedicated handle, so a drag can start right away.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // helpers

  const ids = modules.map((m) => m.key);

  // handlers

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from === -1 || to === -1) return;
    setModuleOrder(arrayMove(ids, from, to));
  }

  // render

  return (
    <Box>
      <Typography variant="subtitle2">Ordre des modules</Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        Glissez pour réordonner le bandeau de gauche.
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <List dense disablePadding>
            {modules.map((m) => (
              <SortableRowModuleOrder
                key={m.key}
                module={m}
                dimmed={
                  !LOCKED_MODULE_KEYS.has(m.key) &&
                  disabledModuleKeys.includes(m.key)
                }
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    </Box>
  );
}
