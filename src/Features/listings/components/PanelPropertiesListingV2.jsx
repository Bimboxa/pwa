import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useUpdateListing from "../hooks/useUpdateListing";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationTemplateQtiesById from "Features/annotations/hooks/useAnnotationTemplateQtiesById";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  Typography,
  InputBase,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Chip,
} from "@mui/material";
import {
  ChevronRight,
  Favorite,
  FavoriteBorder,
  DragIndicator,
  TableChart,
} from "@mui/icons-material";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";
import db from "App/db/db";
import useDndSensors from "App/hooks/useDndSensors";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import OverrideToggle from "Features/annotations/components/OverrideToggle";
import DialogAddMappingCategories from "Features/annotations/components/DialogAddMappingCategories";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import IconButtonMoreActionsListing from "./IconButtonMoreActionsListing";
import useFavoriteListings from "../hooks/useFavoriteListings";

function getTemplateMainColor(template) {
  const shape = resolveDrawingShape(template);
  const shapeType = resolveShapeCategory(shape);
  return shapeType === "polyline"
    ? (template.strokeColor ?? template.fillColor ?? "#999")
    : (template.fillColor ?? template.strokeColor ?? "#999");
}

function parseHexToRgb(hex) {
  const c = hex.replace("#", "");
  if (c.length === 3) {
    return [
      parseInt(c[0] + c[0], 16),
      parseInt(c[1] + c[1], 16),
      parseInt(c[2] + c[2], 16),
    ];
  }
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function lightenColor(hex, alpha = 0.2) {
  const [r, g, b] = parseHexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenColor(hex, amount = 0.4) {
  const [r, g, b] = parseHexToRgb(hex);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `rgb(${dr}, ${dg}, ${db})`;
}

function resolveShortLabel(categoryString, allMappingCategories) {
  if (!categoryString || typeof categoryString !== "string")
    return categoryString;
  const [nomenclatureKey, categoryKey] = categoryString.split(":");
  if (!nomenclatureKey || !categoryKey) return categoryString;
  const nomenclature = allMappingCategories?.find(
    (n) => n.nomenclature.key === nomenclatureKey
  );
  if (!nomenclature) return categoryString;
  const category = nomenclature.categories.find((c) => c.key === categoryKey);
  return category ? category.label : categoryKey;
}

function SortableTemplateRow({
  template,
  spriteImage,
  allMappingCategories,
  qtyLabel,
  onHeightChange,
  onToggleOverride,
  onDeleteCategory,
  onOpenAddCategories,
  onSelect,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: template.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const categories = template.mappingCategories ?? [];
  const chipColor = getTemplateMainColor(template);
  const chipBg = lightenColor(chipColor, 0.2);
  const chipText = darkenColor(chipColor, 0.4);

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      sx={{
        ...style,
        display: "flex",
        borderBottom: `1px solid ${lightenColor(chipColor, 0.3)}`,
      }}
    >
      {/* Drag handle — vertically centered */}
      <Box
        {...listeners}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "grab",
          px: 0.5,
        }}
      >
        <DragIndicator fontSize="small" sx={{ opacity: 0.4 }} />
      </Box>

      {/* Content with left color border */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          py: 0.75,
          pl: 1,
          borderLeft: `3px solid ${chipColor}`,
        }}
      >
        {/* Line 1: icon + label + arrow right */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 0.5 }}>
          <AnnotationTemplateIcon
            template={template}
            spriteImage={spriteImage}
            size={20}
          />
          <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
            {template.label}
          </Typography>
          <IconButton size="small" onClick={() => onSelect(template)}>
            <ChevronRight sx={{ fontSize: 16, color: "text.disabled" }} />
          </IconButton>
        </Box>

        {/* Line 2: height (left) + quantities (right) */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            pl: 3.5,
            pr: 1,
            mt: 0.25,
          }}
        >
          <OverrideToggle
            field="height"
            overrideFields={template.overrideFields}
            onToggle={(field) => onToggleOverride(template, field)}
            size={14}
          />
          <FieldAnnotationHeight
            annotation={{ id: template.id, height: template.height }}
            onChange={(updated) => onHeightChange(template, updated.height)}
          />
          <Box sx={{ flex: 1 }} />
          {qtyLabel && (
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                fontSize: "10px",
                fontWeight: 500,
                color: "secondary.main",
                flexShrink: 0,
              }}
            >
              {qtyLabel}
            </Typography>
          )}
        </Box>

        {/* Line 3: tags */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.5,
            pl: 3.5,
            pr: 1,
            mt: 0.75,
            mb: 0.5,
            flexWrap: "wrap",
          }}
        >
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={resolveShortLabel(cat, allMappingCategories)}
              size="small"
              onDelete={() => onDeleteCategory(template, cat)}
              sx={{
                height: 20,
                fontSize: "0.7rem",
                bgcolor: chipBg,
                color: chipText,
                "& .MuiChip-deleteIcon": { fontSize: 14, color: chipText, opacity: 0.6 },
              }}
            />
          ))}
          <Chip
            label="+ tag"
            size="small"
            variant="outlined"
            onClick={() => onOpenAddCategories(template)}
            sx={{
              height: 20,
              fontSize: "0.7rem",
              borderColor: lightenColor(chipColor, 0.4),
              color: chipText,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default function PanelPropertiesListingV2({ listing }) {
  const dispatch = useDispatch();

  // data

  const updateListing = useUpdateListing();
  const { isFavorite, toggleFavorite } = useFavoriteListings();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listing?.id,
    sortByOrder: true,
  });
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const spriteImage = useAnnotationSpriteImage();
  const appConfig = useAppConfig();
  const allMappingCategories = appConfig?.mappingCategories;
  const sensors = useDndSensors();
  const annotationTemplateQtiesById = useAnnotationTemplateQtiesById();
  const listingAnnotations = useAnnotationsV2({
    filterByListingId: listing?.id,
    excludeBgAnnotations: true,
    withQties: true,
    withEntity: true,
    caller: "PanelPropertiesListingV2",
  });
  const selectedBaseMapId = useSelector(
    (s) => s.mapEditor.selectedBaseMapId
  );
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const templateIds = useMemo(
    () => (annotationTemplates || []).map((t) => t.id),
    [annotationTemplates]
  );

  // state

  const [name, setName] = useState(listing?.name ?? "");
  const [addCategoriesTemplate, setAddCategoriesTemplate] = useState(null);
  const [openTableDialog, setOpenTableDialog] = useState(false);

  useEffect(() => {
    setName(listing?.name ?? "");
  }, [listing?.id, listing?.name]);

  // data - base maps with annotation counts for this listing

  const baseMapRows = useLiveQuery(
    async () => {
      if (!listing?.id || !projectId) return [];
      const baseMaps = (
        await db.baseMaps.where("projectId").equals(projectId).toArray()
      ).filter((bm) => !bm.deletedAt);

      const annotations = (
        await db.annotations
          .where("listingId")
          .equals(listing.id)
          .toArray()
      ).filter((a) => !a.deletedAt && !a.isBaseMapAnnotation);

      const countByBaseMapId = {};
      annotations.forEach((a) => {
        if (a.baseMapId) {
          countByBaseMapId[a.baseMapId] =
            (countByBaseMapId[a.baseMapId] || 0) + 1;
        }
      });

      return baseMaps
        .map((bm) => ({
          id: bm.id,
          name: bm.name || "Sans nom",
          count: countByBaseMapId[bm.id] || 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [listing?.id, projectId, annotationsUpdatedAt]
  );

  // helpers

  const label = listing?.name ?? "Liste";

  // handlers

  const handleNameBlur = async () => {
    if (!listing?.id || name === listing.name) return;
    await updateListing({ id: listing.id, name });
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
  };

  const handleSelectBaseMap = (baseMapId) => {
    dispatch(setSelectedMainBaseMapId(baseMapId));
  };

  const handleHeightChange = (template, height) => {
    updateAnnotationTemplate({
      id: template.id,
      height,
      listingId: listing.id,
      projectId,
    });
  };

  const handleToggleOverride = (template, field) => {
    const current = Array.isArray(template.overrideFields)
      ? [...template.overrideFields]
      : [];
    const index = current.indexOf(field);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(field);
    }
    updateAnnotationTemplate({
      id: template.id,
      overrideFields: current,
      listingId: listing.id,
      projectId,
    });
  };

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !annotationTemplates?.length) return;

    const oldIndex = templateIds.indexOf(active.id);
    const newIndex = templateIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let newOrderIndex;
    if (oldIndex < newIndex) {
      const b = annotationTemplates[newIndex]?.orderIndex ?? null;
      const a =
        newIndex + 1 < annotationTemplates.length
          ? annotationTemplates[newIndex + 1]?.orderIndex
          : null;
      newOrderIndex = generateKeyBetween(b, a);
    } else {
      const b =
        newIndex > 0
          ? annotationTemplates[newIndex - 1]?.orderIndex
          : null;
      const a = annotationTemplates[newIndex]?.orderIndex ?? null;
      newOrderIndex = generateKeyBetween(b, a);
    }

    await db.annotationTemplates.update(active.id, {
      orderIndex: newOrderIndex,
    });
  }

  function handleDeleteCategory(template, categoryString) {
    const updated = (template.mappingCategories ?? []).filter(
      (c) => c !== categoryString
    );
    updateAnnotationTemplate({
      id: template.id,
      mappingCategories: updated,
      listingId: listing.id,
      projectId,
    });
  }

  function handleSelectTemplate(template) {
    dispatch(setSelectedItem({ id: template.id, type: "ANNOTATION_TEMPLATE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleAddCategories(newCategories) {
    if (!addCategoriesTemplate) return;
    const current = addCategoriesTemplate.mappingCategories ?? [];
    const merged = [...current, ...newCategories];
    updateAnnotationTemplate({
      id: addCategoriesTemplate.id,
      mappingCategories: merged,
      listingId: addCategoriesTemplate.listingId,
      projectId,
    });
    setAddCategoriesTemplate(null);
  }

  const handleToggleFavorite = async () => {
    if (!listing?.id) return;
    const templates = (
      await db.annotationTemplates
        .where("listingId")
        .equals(listing.id)
        .toArray()
    ).filter((t) => !t.deletedAt);
    toggleFavorite({ listing, annotationTemplates: templates });
  };

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 2,
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            Liste
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>
        <IconButtonMoreActionsListing listing={listing} />
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {/* Name field */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
          >
            Nom
          </Typography>
          <InputBase
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            fullWidth
            sx={{
              fontSize: "0.875rem",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              "&:focus-within": {
                borderColor: "primary.main",
              },
            }}
          />
        </WhiteSectionGeneric>

        {/* Favorite toggle */}
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              Favori
            </Typography>
            <IconButton size="small" onClick={handleToggleFavorite}>
              {isFavorite(listing?.id) ? (
                <Favorite sx={{ color: "orange", fontSize: 20 }} />
              ) : (
                <FavoriteBorder sx={{ color: "text.disabled", fontSize: 20 }} />
              )}
            </IconButton>
          </Box>
        </WhiteSectionGeneric>

        {/* Annotation templates */}
        {annotationTemplates?.length > 0 && (
          <WhiteSectionGeneric>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.5,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Modèles
              </Typography>
              <IconButton
                size="small"
                onClick={() => setOpenTableDialog(true)}
              >
                <TableChart sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
            <Box sx={{ mx: -1, mb: -1 }}>
              <SortableContext
                items={templateIds}
                strategy={verticalListSortingStrategy}
              >
                {annotationTemplates.map((template) => (
                  <SortableTemplateRow
                    key={template.id}
                    template={template}
                    spriteImage={spriteImage}
                    allMappingCategories={allMappingCategories}
                    qtyLabel={annotationTemplateQtiesById?.[template.id]?.mainQtyLabel}
                    onHeightChange={handleHeightChange}
                    onToggleOverride={handleToggleOverride}
                    onDeleteCategory={handleDeleteCategory}
                    onOpenAddCategories={setAddCategoriesTemplate}
                    onSelect={handleSelectTemplate}
                  />
                ))}
              </SortableContext>
            </Box>
            </DndContext>
          </WhiteSectionGeneric>
        )}

        {addCategoriesTemplate && (
          <DialogAddMappingCategories
            open={!!addCategoriesTemplate}
            onClose={() => setAddCategoriesTemplate(null)}
            allMappingCategories={allMappingCategories}
            currentCategories={addCategoriesTemplate.mappingCategories ?? []}
            onAdd={handleAddCategories}
          />
        )}

        <DialogGeneric
          title={listing?.name ?? "Annotations"}
          open={openTableDialog}
          onClose={() => setOpenTableDialog(false)}
          vw="90"
          vh="80"
        >
          <BoxFlexVStretch>
            <DatagridAnnotations
              annotations={listingAnnotations ?? []}
              onClose={() => setOpenTableDialog(false)}
            />
          </BoxFlexVStretch>
        </DialogGeneric>

        {/* Annotations per base map */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
          >
            Annotations par fond de plan
          </Typography>
          <List dense disablePadding>
            {baseMapRows?.map((row) => {
              const isSelected = row.id === selectedBaseMapId;
              return (
                <ListItemButton
                  key={row.id}
                  onClick={() => handleSelectBaseMap(row.id)}
                  sx={{
                    borderRadius: 1,
                    py: 0.5,
                    px: 1,
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <ListItemText
                    primary={row.name}
                    primaryTypographyProps={{
                      variant: "body2",
                      fontWeight: isSelected ? 600 : 400,
                      noWrap: true,
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      fontWeight: 500,
                      color: row.count > 0 ? "secondary.main" : "text.disabled",
                      mr: 0.5,
                      minWidth: 20,
                      textAlign: "right",
                    }}
                  >
                    {row.count}
                  </Typography>
                  <ChevronRight
                    sx={{ fontSize: 16, color: "text.disabled" }}
                  />
                </ListItemButton>
              );
            })}
            {baseMapRows?.length === 0 && (
              <Typography
                variant="body2"
                color="text.disabled"
                sx={{ py: 1, textAlign: "center" }}
              >
                Aucun fond de plan
              </Typography>
            )}
          </List>
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
