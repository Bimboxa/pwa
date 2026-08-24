import { useState, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Box,
  Button,
  List,
  ListItemButton,
  Typography,
  Divider,
} from "@mui/material";
import Add from "@mui/icons-material/Add";

import RowPanelDrawingTemplate from "./RowPanelDrawingTemplate";
import AnnotationTemplateRowRevolutionAxisVertical from "Features/mapEditor/components/AnnotationTemplateRowRevolutionAxisVertical";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useReorderAnnotationTemplates from "Features/annotations/hooks/useReorderAnnotationTemplates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// ListPanelDrawingTemplates — template rows of the active listing (grouped by
// groupLabel), with DnD reorder (only under the "Tous" filter — reordering a
// filtered subset is ambiguous) and the "Nouveau modèle" add row.
// ---------------------------------------------------------------------------

function SortableRow({ ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.annotationTemplate.id });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const RowComponent = props.RowComponent ?? RowPanelDrawingTemplate;

  return (
    <RowComponent
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={sortableStyle}
      sortableAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

export default function ListPanelDrawingTemplates({ listingId, qtiesById }) {
  // data

  const templates = useAnnotationTemplates({
    filterByListingId: listingId,
    sortByOrder: true,
  });
  const spriteImage = useAnnotationSpriteImage();
  const reorderAnnotationTemplates = useReorderAnnotationTemplates();
  const templateFilter = useSelector((s) => s.panelDrawing.templateFilter);
  // REVOLUTION_AXIS templates on a VERTICAL base map swap to the dedicated row
  // that DROPS an existing plan axis instead of drawing a new one (2D only).
  const baseMap = useMainBaseMap();
  const isVerticalBaseMap = baseMap?.orientation === "VERTICAL";
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // helpers

  const filteredTemplates = useMemo(() => {
    const arr = templates ?? [];
    if (templateFilter === "VISIBLE") return arr.filter((t) => !t.hidden);
    if (templateFilter === "HIDDEN") return arr.filter((t) => t.hidden);
    return arr;
  }, [templates, templateFilter]);

  // Group headers computed on the filtered set: emptied groups drop their
  // header.
  const groupedItems = useMemo(
    () => groupAnnotationTemplatesByGroupLabel(filteredTemplates),
    [filteredTemplates]
  );

  const dndEnabled = templateFilter === "ALL";

  const sortableIds = useMemo(
    () => filteredTemplates.map((t) => t.id),
    [filteredTemplates]
  );

  // dnd sensors

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // dnd handlers

  const handleDragEnd = useCallback(
    (event) => reorderAnnotationTemplates(event, templates),
    [reorderAnnotationTemplates, templates]
  );

  // render - empty listing: explicit create-first-template section instead
  // of rows + the dashed add row (`templates` is undefined while loading).

  if (templates && templates.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          mx: 1.5,
          px: 2,
          py: 3,
          textAlign: "center",
          bgcolor: "background.paper",
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 3,
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Aucun modèle dans cette liste. Créez votre premier modèle pour
          commencer à dessiner.
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Add />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Nouveau modèle
        </Button>

        {openCreateDialog && (
          <DialogCreateAnnotationTemplate
            open={openCreateDialog}
            onClose={() => setOpenCreateDialog(false)}
            listingId={listingId}
          />
        )}
      </Box>
    );
  }

  const rows = (
    <List dense disablePadding>
      {groupedItems?.map((item, idx) => {
        if (item.isGroupDivider) {
          return (
            <Divider
              key={`divider-${idx}`}
              sx={{ mx: 2, my: 0.5, borderColor: "divider" }}
            />
          );
        }
        if (item.isGroupHeader) {
          return (
            <Typography
              key={`group-${item.groupLabel}`}
              variant="caption"
              sx={{
                display: "block",
                pl: 2,
                pt: idx > 0 ? 1 : 0.5,
                pb: 0.5,
                color: "text.secondary",
                textTransform: "uppercase",
                fontWeight: 600,
                fontSize: "0.7rem",
                letterSpacing: 0.5,
              }}
            >
              {item.groupLabel}
            </Typography>
          );
        }
        if (item?.isDivider) return null;
        const isVerticalAxisRow =
          !isThreedEditor &&
          isVerticalBaseMap &&
          resolveDrawingShape(item) === "REVOLUTION_AXIS";
        const rowProps = {
          annotationTemplate: item,
          listingId,
          qties: qtiesById?.[item.id],
          spriteImage,
          dndEnabled,
        };
        if (isVerticalAxisRow) {
          // Popper-styled row kept for the axis-drop flow (count feeds its
          // qty label slot).
          return dndEnabled ? (
            <SortableRow
              key={item.id}
              RowComponent={AnnotationTemplateRowRevolutionAxisVertical}
              {...rowProps}
              count={qtiesById?.[item.id]?.count || 0}
              qtyLabel={qtiesById?.[item.id]?.mainQtyLabel}
            />
          ) : (
            <AnnotationTemplateRowRevolutionAxisVertical
              key={item.id}
              {...rowProps}
              count={qtiesById?.[item.id]?.count || 0}
              qtyLabel={qtiesById?.[item.id]?.mainQtyLabel}
            />
          );
        }
        return dndEnabled ? (
          <SortableRow key={item.id} {...rowProps} />
        ) : (
          <RowPanelDrawingTemplate key={item.id} {...rowProps} />
        );
      })}
    </List>
  );

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      {dndEnabled ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {rows}
          </SortableContext>
        </DndContext>
      ) : (
        rows
      )}

      {/* + Nouveau modèle */}
      <ListItemButton
        onClick={() => setOpenCreateDialog(true)}
        sx={{
          pl: 2,
          pr: 1,
          py: 1,
          alignItems: "center",
          borderTop: "1px solid",
          borderColor: "divider",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            mr: 1,
          }}
        >
          <Box
            sx={{
              width: 18,
              height: 18,
              border: "1.5px dashed",
              borderColor: "panel.textLight",
              borderRadius: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Add sx={{ fontSize: 12, color: "panel.textLight" }} />
          </Box>
        </Box>
        <Typography variant="body2" color="panel.textLight">
          Nouveau modèle
        </Typography>
      </ListItemButton>

      {openCreateDialog && (
        <DialogCreateAnnotationTemplate
          open={openCreateDialog}
          onClose={() => setOpenCreateDialog(false)}
          listingId={listingId}
        />
      )}
    </Box>
  );
}
