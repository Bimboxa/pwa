import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setDetailTemplateId,
  setDetailView,
} from "Features/panelDrawing/panelDrawingSlice";
import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";
import {
  setSelectedItems,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Button, IconButton, Typography, Link } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import RowTemplateAnnotation from "./RowTemplateAnnotation";
import ChipsViewerScope from "./ChipsViewerScope";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getZeroPaddingNumber from "Features/misc/utils/getZeroPaddingNumber";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";

// ---------------------------------------------------------------------------
// PanelTemplateAnnotations — detail view of the Dessin panel (#311): the
// annotations of one annotation template, sorted by draw order, with the
// template header actions (Propriétés du modèle / Isoler / Tout sél.).
// ---------------------------------------------------------------------------

function formatQty(value, decimals = 2) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(decimals) : "0";
}

export default function PanelTemplateAnnotations({
  template,
  listing,
  annotations,
  templateQties,
  spriteImage,
}) {
  const dispatch = useDispatch();

  // strings

  const breadcrumbRootS = "Annotations";
  const propertiesS = "Propriétés du modèle";
  const soloS = "Isoler";
  const selectAllS = "Tout sél.";
  const emptyListS =
    "Utilisez la barre d'outil dans l'éditeur pour dessiner une annotation";

  // data

  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  // Scope chips (shared with the panels' root views): the active base map or
  // the whole repérage; in "Tous" the list is grouped by base map.
  const viewerScope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);
  const isAllScope = viewerScope === "ALL";

  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps } = useBaseMaps();

  // helpers

  const isSolo = soloTemplateId === template.id;
  const templateColor = template?.fillColor ?? template?.strokeColor ?? "#999";

  // "trié par ordre de tracé" — createdAt is an ISO string, stamped by the
  // Dexie creating hook.
  const sortedAnnotations = useMemo(
    () =>
      [...(annotations ?? [])].sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
      ),
    [annotations]
  );

  const count = sortedAnnotations.length;
  const listingNameS = listing?.name ?? listing?.label ?? "Liste";

  // No annotation yet: a plain "0 annot." line instead of the zero units.
  const qtyLine =
    count > 0
      ? `${formatQty(templateQties?.unit ?? 0, 0)} u · ${formatQty(
          templateQties?.length ?? 0
        )} ml · ${formatQty(templateQties?.surface ?? 0)} m²`
      : "0 annot.";

  // "Tous" scope: one group per base map (first-appearance order in the
  // draw-ordered list; global indices keep the derived labels and the
  // prev/next arrows consistent).
  const baseMapGroups = useMemo(() => {
    if (!isAllScope) return null;
    const baseMapById = getItemsByKey(baseMaps ?? [], "id");
    const byKey = new Map();
    sortedAnnotations.forEach((annotation, idx) => {
      const key = annotation.baseMapId ?? "NONE";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ annotation, idx });
    });
    return Array.from(byKey.entries()).map(([key, items]) => ({
      key,
      baseMap: baseMapById[key],
      items,
    }));
  }, [isAllScope, sortedAnnotations, baseMaps]);

  // handlers

  const handleBack = () => {
    dispatch(setDetailTemplateId(null));
  };

  // The template properties open IN the panel (PanelTemplateProperties
  // subview), not in the right panel.
  const handleOpenTemplateProperties = () => {
    dispatch(setDetailView("PROPERTIES"));
  };

  const handleToggleSolo = () => {
    dispatch(setSoloAnnotationTemplateId(isSolo ? null : template.id));
  };

  // Same item shape as the 2D lasso selection (InteractionLayer buildItem).
  const handleSelectAll = () => {
    const items = sortedAnnotations.map((a) => ({
      id: a.id,
      nodeId: a.id,
      type: "NODE",
      nodeType: "ANNOTATION",
      annotationType: a.type,
      entityId: a.entityId,
      listingId: a.listingId,
      annotationTemplateId: a.annotationTemplateId,
      pointId: null,
      partId: null,
      partType: null,
    }));
    dispatch(setSelectedItems(items));
    if (items.length === 1) dispatch(setShowAnnotationsProperties(true));
    if (items.length > 0)
      dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
      }}
    >
      {/* Breadcrumb */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 2,
          pt: 1.5,
          pb: 1,
        }}
      >
        <Link
          component="button"
          underline="always"
          onClick={handleBack}
          sx={{ color: "text.secondary", fontSize: "0.875rem" }}
        >
          {breadcrumbRootS}
        </Link>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          /
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {template.label}
        </Typography>
      </Box>

      {/* Header: back + icon + title */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, pb: 1 }}
      >
        <IconButton
          onClick={handleBack}
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            flexShrink: 0,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ChevronLeft sx={{ fontSize: 20 }} />
        </IconButton>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            flexShrink: 0,
          }}
        >
          <AnnotationTemplateIcon
            template={template}
            size={28}
            spriteImage={spriteImage}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>
            {listingNameS}
          </Typography>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            {template.label}
          </Typography>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, px: 1.5, pb: 1.5 }}>
        <Button
          onClick={handleOpenTemplateProperties}
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            color: "text.primary",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {propertiesS}
        </Button>
        <Button
          onClick={handleToggleSolo}
          sx={{
            bgcolor: isSolo ? "grey.900" : "background.paper",
            border: "1px solid",
            borderColor: isSolo ? "grey.900" : "divider",
            borderRadius: 3,
            color: isSolo ? "common.white" : "text.primary",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": {
              bgcolor: isSolo ? "grey.800" : "action.hover",
            },
          }}
        >
          {soloS}
        </Button>
        <Button
          onClick={handleSelectAll}
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            color: "text.primary",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {selectAllS}
        </Button>
      </Box>

      {/* Scope chips: active base map or "Tous" */}
      <ChipsViewerScope
        baseMapName={mainBaseMap?.name ?? mainBaseMap?.label ?? "Fond de plan"}
      />

      {/* Summary line */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Typography
          variant="caption"
          noWrap
          sx={{ fontFamily: "monospace", fontWeight: 500 }}
        >
          {qtyLine}
        </Typography>
      </Box>

      {/* Annotations list — grouped by base map in "Tous" scope */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {count === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 1,
              px: 4,
            }}
          >
            <Typography
              variant="body2"
              align="center"
              sx={{ color: "text.secondary" }}
            >
              {emptyListS}
            </Typography>
          </Box>
        ) : isAllScope ? (
          baseMapGroups?.map(({ key, baseMap, items }) => (
            <Box key={key}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: "panel.sectionBg",
                  borderTop: "1px solid",
                  borderBottom: "1px solid",
                  borderColor: "panel.border",
                }}
              >
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ flex: 1, fontWeight: 700, minWidth: 0 }}
                >
                  {baseMap?.name ?? baseMap?.label ?? "Sans fond de plan"}
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    fontFamily: "monospace",
                    color: "text.secondary",
                    flexShrink: 0,
                  }}
                >
                  {`${items.length} u`}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: "background.paper" }}>
                {items.map(({ annotation, idx }) => (
                  <RowTemplateAnnotation
                    key={annotation.id}
                    annotation={annotation}
                    label={
                      getAnnotationOwnLabel(annotation) ||
                      `${template.label} ${getZeroPaddingNumber(idx + 1, 2)}`
                    }
                    color={templateColor}
                  />
                ))}
              </Box>
            </Box>
          ))
        ) : (
          <Box
            sx={{
              bgcolor: "background.paper",
              borderTop: "1px solid",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            {sortedAnnotations.map((annotation, idx) => (
              <RowTemplateAnnotation
                key={annotation.id}
                annotation={annotation}
                // The annotation's OWN label (not the entity-enriched one);
                // derived "<template> NN" only when the row has none.
                label={
                  getAnnotationOwnLabel(annotation) ||
                  `${template.label} ${getZeroPaddingNumber(idx + 1, 2)}`
                }
                color={templateColor}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
