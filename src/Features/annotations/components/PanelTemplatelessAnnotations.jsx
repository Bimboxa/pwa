import { useMemo } from "react";
import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  Typography,
} from "@mui/material";
import Back from "@mui/icons-material/ArrowBack";
import QuestionMark from "@mui/icons-material/QuestionMark";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";
import useSelectAnnotationsOnMap from "Features/mapEditor/hooks/useSelectAnnotationsOnMap";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import {
  isTemplatelessAnnotation,
  TEMPLATELESS_LABEL,
} from "Features/annotations/utils/templatelessAnnotations";

// ---------------------------------------------------------------------------
// PanelTemplatelessAnnotations — right panel of the « Annotations sans
// modèle » row (Dessin popper / docked Dessin panel, "Propriétés" button):
// the annotations drawn without template (« Dessin » command) of the
// selected scope on the main base map, one row each with its label and
// quantities. Row click = select the annotation on the map and zoom to it
// (same action as the template detail view); "Tout sélectionner" = the
// multi-selection of all of them. Selection item type:
// TEMPLATELESS_ANNOTATIONS (PanelSelectionProperties).
// ---------------------------------------------------------------------------

function formatQty(value) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(2) : "0";
}

export default function PanelTemplatelessAnnotations() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Annotations";
  const titleS = "Annotations sans modèle";
  const selectAllS = "Tout sélectionner";
  const emptyS = "Aucune annotation sans modèle sur ce fond de plan.";
  const countS = (n) => `${n} annotation${n > 1 ? "s" : ""}`;

  // data

  const baseMap = useMainBaseMap();
  const allAnnotations = useAnnotationsV2({
    caller: "PanelTemplatelessAnnotations",
    enabled: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
  });
  const selectAnnotation = useSelectAnnotationFromPanel();
  const { selectAnnotations } = useSelectAnnotationsOnMap();

  // helpers

  const annotations = useMemo(
    () =>
      (allAnnotations ?? [])
        // scope-level rows only: the ones drawn on a located business
        // object belong to its listing's « Sans modèle » row
        .filter((a) => isTemplatelessAnnotation(a) && !a.listingId)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [allAnnotations]
  );
  const count = annotations.length;
  const baseMapName = baseMap?.name ?? baseMap?.label ?? "Fond de plan";

  const getRowLabel = (annotation, index) =>
    getAnnotationOwnLabel(annotation) ||
    `${TEMPLATELESS_LABEL} ${String(index + 1).padStart(2, "0")}`;

  const getQtyLine = (annotation) => {
    const qties = getAnnotationQties({
      annotation,
      meterByPx: baseMap?.meterByPx,
    });
    const length = qties?.lengthDeveloped ?? qties?.length ?? 0;
    const surface = qties?.surfaceDeveloped ?? qties?.surface ?? 0;
    return `${formatQty(length)} ml · ${formatQty(surface)} m²`;
  };

  // handlers

  const handleBack = () => dispatch(clearSelection());

  const handleSelectAll = () => {
    if (count === 0) return;
    selectAnnotations(annotations);
  };

  // render

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {captionS}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflowY: "auto", p: 1.5, gap: 1 }}>
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              px: 1.5,
              py: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {countS(count)}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ display: "block", color: "text.secondary" }}
              >
                {baseMapName}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              disabled={count === 0}
              onClick={handleSelectAll}
              sx={{ flexShrink: 0 }}
            >
              {selectAllS}
            </Button>
          </Box>
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          {count === 0 ? (
            <Typography
              variant="body2"
              sx={{ px: 1.5, py: 1.5, color: "text.secondary" }}
            >
              {emptyS}
            </Typography>
          ) : (
            <List dense disablePadding>
              {annotations.map((annotation, index) => (
                <ListItemButton
                  key={annotation.id}
                  onClick={() => selectAnnotation(annotation)}
                  sx={{
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    "&:not(:last-child)": {
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 2,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "action.hover",
                      color: "panel.textMuted",
                    }}
                  >
                    <QuestionMark sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {getRowLabel(annotation, index)}
                    </Typography>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        display: "block",
                        fontFamily: "monospace",
                        fontWeight: 500,
                        color: "text.secondary",
                      }}
                    >
                      {getQtyLine(annotation)}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          )}
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
