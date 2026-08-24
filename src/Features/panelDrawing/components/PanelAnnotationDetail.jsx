import { useDispatch } from "react-redux";

import {
  setDetailTemplateId,
  setDetailView,
} from "Features/panelDrawing/panelDrawingSlice";

import { Box, IconButton, Typography, Link } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";

import SectionAnnotationPropertiesBody from "Features/annotations/components/SectionAnnotationPropertiesBody";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";
import getZeroPaddingNumber from "Features/misc/utils/getZeroPaddingNumber";

// ---------------------------------------------------------------------------
// PanelAnnotationDetail — one annotation's properties in the Dessin panel
// (#311): breadcrumb (Annotations / <template> / <annotation>), header with
// prev / next arrows cycling through the template's annotations (draw
// order), and the shared properties body (Propriété / Etiquette / Objet
// tabs, selection-driven — the arrows and rows keep the map selection in
// sync).
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

  // data

  const selectAnnotation = useSelectAnnotationFromPanel();

  // helpers

  const label = `${template.label} ${getZeroPaddingNumber(
    annotationIndex + 1,
    2
  )}`;
  const prevAnnotation = annotations[annotationIndex - 1];
  const nextAnnotation = annotations[annotationIndex + 1];

  // handlers

  const handleBackToList = () => {
    dispatch(setDetailTemplateId(null));
  };

  const handleBackToAnnotations = () => {
    dispatch(setDetailView("ANNOTATIONS"));
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
            onClick={() => selectAnnotation(prevAnnotation)}
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
            onClick={() => selectAnnotation(nextAnnotation)}
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

      {/* Shared properties body (tabs + content, selection-driven) */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <SectionAnnotationPropertiesBody />
      </Box>
    </Box>
  );
}
