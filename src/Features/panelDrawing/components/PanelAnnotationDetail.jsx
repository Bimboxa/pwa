import { useDispatch, useSelector } from "react-redux";

import {
  setDetailTemplateId,
  setDetailView,
  setDetailAnnotationId,
} from "Features/panelDrawing/panelDrawingSlice";
import { setSoloAnnotationId } from "Features/annotations/annotationsSlice";

import { Box, Button, IconButton, Typography, Link } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";

import SectionAnnotationPropertiesBody from "Features/annotations/components/SectionAnnotationPropertiesBody";
import SectionAnnotationOverview from "Features/annotations/components/SectionAnnotationOverview";
import FieldAnnotationLabel from "Features/annotations/components/FieldAnnotationLabel";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";
import getZeroPaddingNumber from "Features/misc/utils/getZeroPaddingNumber";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";

// ---------------------------------------------------------------------------
// PanelAnnotationDetail — one annotation's properties in the Dessin panel
// (#311): breadcrumb (Annotations / <template> / <annotation>), header with
// prev / next arrows cycling through the template's annotations (draw
// order, panel navigation only), the Sélectionner / Isoler actions, and the
// shared properties body fed by prop — displaying an annotation here never
// touches the selection; selecting it on the map is the explicit
// "Sélectionner" action.
// ---------------------------------------------------------------------------

export default function PanelAnnotationDetail({
  template,
  annotations,
  annotationIndex,
}) {
  const dispatch = useDispatch();

  // strings

  const breadcrumbRootS = "Annotations";
  const subtitleS = "Annotation";
  const selectS = "Sélectionner";
  const soloS = "Isoler";

  // data

  const selectAnnotation = useSelectAnnotationFromPanel();
  const soloAnnotationId = useSelector((s) => s.annotations.soloAnnotationId);

  // helpers

  // The annotation's OWN label (not the entity-enriched one); derived
  // "<template> NN" only when the row has none — same rule as the list.
  const annotation = annotations[annotationIndex];
  const label =
    getAnnotationOwnLabel(annotation) ||
    `${template.label} ${getZeroPaddingNumber(annotationIndex + 1, 2)}`;
  const prevAnnotation = annotations[annotationIndex - 1];
  const nextAnnotation = annotations[annotationIndex + 1];
  const isSolo = soloAnnotationId === annotation?.id;

  // handlers

  const handleBackToList = () => {
    dispatch(setDetailTemplateId(null));
  };

  const handleBackToAnnotations = () => {
    dispatch(setDetailView("ANNOTATIONS"));
  };

  // Prev / next only navigate the panel — no selection side effect.
  const handleGoTo = (target) => {
    if (target) dispatch(setDetailAnnotationId(target.id));
  };

  const handleSelect = () => {
    selectAnnotation(annotation);
  };

  const handleToggleSolo = () => {
    dispatch(setSoloAnnotationId(isSolo ? null : annotation?.id));
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
          onClick={handleBackToList}
          sx={{ color: "text.secondary", fontSize: "0.875rem" }}
        >
          {breadcrumbRootS}
        </Link>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          /
        </Typography>
        <Link
          component="button"
          underline="always"
          onClick={handleBackToAnnotations}
          sx={{
            color: "text.secondary",
            fontSize: "0.875rem",
            maxWidth: 110,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {template.label}
        </Link>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          /
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>

      {/* Header: back + title + prev/next arrows */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, pb: 1 }}
      >
        <IconButton
          onClick={handleBackToAnnotations}
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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            noWrap
            sx={{ display: "block", color: "text.secondary" }}
          >
            {subtitleS}
          </Typography>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            {label}
          </Typography>
        </Box>
        {/* Prev / next annotation of the template (draw order) */}
        <Box sx={{ display: "flex", gap: 0.75, flexShrink: 0 }}>
          <IconButton
            size="small"
            disabled={!prevAnnotation}
            onClick={() => handleGoTo(prevAnnotation)}
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ChevronLeft sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            size="small"
            disabled={!nextAnnotation}
            onClick={() => handleGoTo(nextAnnotation)}
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ChevronRight sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Actions — same design as the template subview's Isoler / Tout sél. */}
      <Box sx={{ display: "flex", gap: 1, px: 1.5, pb: 1.5 }}>
        <Button
          onClick={handleSelect}
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
          {selectS}
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
      </Box>

      {/* Label field + shape overview / quantities card — above the tabs
          (pulled out of the Propriété tab via hideOverview). */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          px: 1.5,
          pb: 1.5,
        }}
      >
        <FieldAnnotationLabel annotation={annotation} />
        <SectionAnnotationOverview annotation={annotation} />
      </Box>

      {/* Shared properties body (tabs + content), fed by prop — no selection
          side effect from displaying the annotation here. */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <SectionAnnotationPropertiesBody annotation={annotation} hideOverview />
      </Box>
    </Box>
  );
}
