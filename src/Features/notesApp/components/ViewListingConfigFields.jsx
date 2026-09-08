import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  Add,
  DragIndicator,
  ArrowForwardIos as Forward,
} from "@mui/icons-material";

import useDndSensors from "App/hooks/useDndSensors";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import HeaderListingConfigView from "./HeaderListingConfigView";

import {
  getFieldSummary,
  syncDerivedFromFields,
} from "../utils/notesAppListingSettings";

// The "Modèle" tab of the mobile ConfigEntityModelScreen: the ordered
// fields of the object form. Reorder = drag (same resulting array as the
// Krnet "rotate down" button); a row opens the field editor.

function SortableFieldRow({ field, summary, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  return (
    <ListItemButton
      ref={setNodeRef}
      onClick={onOpen}
      sx={{
        py: 0.5,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        bgcolor: isDragging ? "action.hover" : undefined,
      }}
    >
      <IconButton
        size="small"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        sx={{ cursor: "grab", mr: 0.5, touchAction: "none" }}
      >
        <DragIndicator fontSize="small" color="action" />
      </IconButton>
      <ListItemText
        primary={field.label || "(sans nom)"}
        secondary={summary}
        slotProps={{
          primary: { variant: "body2", noWrap: true },
          secondary: { variant: "caption", noWrap: true },
        }}
      />
      <Forward sx={{ fontSize: 14, color: "text.secondary", ml: 1 }} />
    </ListItemButton>
  );
}

export default function ViewListingConfigFields({
  listing,
  config,
  update,
  refs,
  navigate,
  appName,
}) {
  // strings

  const titleS = "Modèle de fiche";
  const captionS = `Configuration ${appName} · ${listing?.name ?? ""}`;
  const hintS =
    "Les champs définissent la « Fiche » de chaque objet. Glissez une ligne pour la déplacer ; la flèche › ouvre sa configuration.";
  const emptyS = "Aucun champ pour le moment.";
  const addS = "Ajouter un champ";

  // data

  const sensors = useDndSensors();
  const { fields, stateModelById } = config;
  const summaryCtx = {
    listingById: refs.listingById,
    stateModelById,
    ignoredRemoteIds: refs.ignoredRemoteIds,
  };

  // handlers

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(fields, from, to);
    update.updateSettings((s) => syncDerivedFromFields(s, next));
  }

  // render

  return (
    <>
      <HeaderListingConfigView
        caption={captionS}
        title={titleS}
        onBack={navigate.pop}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
        <WhiteSectionGeneric>
          {fields.length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              {emptyS}
            </Typography>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense disablePadding sx={{ mx: -1 }}>
                  {fields.map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      summary={getFieldSummary(field, summaryCtx)}
                      onOpen={() =>
                        navigate.push({ key: "FIELD", fieldId: field.id })
                      }
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          )}
        </WhiteSectionGeneric>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={() => navigate.push({ key: "FIELD", fieldId: null })}
        >
          {addS}
        </Button>
      </Box>
    </>
  );
}
