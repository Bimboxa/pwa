import { useState } from "react";
import { useDispatch } from "react-redux";

import {
  setDetailTemplateId,
  setDetailView,
} from "Features/panelDrawing/panelDrawingSlice";

import { Box, IconButton, Typography, Link, Tabs, Tab } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import FormAnnotationTemplateVariantBlock from "Features/annotations/components/FormAnnotationTemplateVariantBlock";
import IconButtonMoreActionsAnnotationTemplate from "Features/annotations/components/IconButtonMoreActionsAnnotationTemplate";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";

// ---------------------------------------------------------------------------
// PanelTemplateProperties — template landing subview of the Dessin panel
// (#311): opened by clicking a template row. Breadcrumb (Annotations /
// <template>), header with the template identity + "..." actions, an
// "N annotations · voir la liste" card navigating to the annotations
// subview, and the existing template form (Principal / Avancé tabs,
// FormAnnotationTemplateVariantBlock).
// ---------------------------------------------------------------------------

export default function PanelTemplateProperties({
  template,
  annotationsCount,
}) {
  const dispatch = useDispatch();

  // strings

  const breadcrumbRootS = "Annotations";
  const subtitleS = "Modèle d'annotation";
  const seeListS = "voir la liste";
  const hintS =
    `Les propriétés du modèle s'appliquent aux ${annotationsCount} ` +
    "annotations de ce type. Les cadenas verrouillent une valeur pour " +
    "empêcher toute modification individuelle.";

  // data

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // state

  const [tab, setTab] = useState("MAIN");

  // handlers

  const handleBackToList = () => {
    dispatch(setDetailTemplateId(null));
  };

  const handleOpenAnnotations = () => {
    dispatch(setDetailView("ANNOTATIONS"));
  };

  const handleChange = (newAnnotationTemplate) => {
    updateAnnotationTemplate(newAnnotationTemplate);
  };

  // Duplicating from here: the panel detail moves to the duplicate.
  const handleDuplicated = (createdTemplate) => {
    dispatch(setDetailTemplateId(createdTemplate.id));
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
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {template.label}
        </Typography>
      </Box>

      {/* Header: back + icon + title + more actions */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, pb: 1 }}
      >
        <IconButton
          onClick={handleBackToList}
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
          <AnnotationTemplateIcon template={template} size={28} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              fontStyle: "italic",
              color: "text.secondary",
            }}
          >
            {subtitleS}
          </Typography>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            {template.label}
          </Typography>
        </Box>
        <IconButtonMoreActionsAnnotationTemplate
          annotationTemplate={template}
          onDuplicated={handleDuplicated}
        />
      </Box>

      {/* Annotations count card → annotations subview */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Box
          component="button"
          onClick={handleOpenAnnotations}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            py: 1.25,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {`${annotationsCount} annotation${annotationsCount > 1 ? "s" : ""}`}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.25,
              color: "text.secondary",
            }}
          >
            <Typography variant="body2">{seeListS}</Typography>
            <ChevronRight sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>

      {/* Tabs + template form (shared with the right panel) */}
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Principal" value="MAIN" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Avancé" value="ADVANCED" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <FormAnnotationTemplateVariantBlock
          annotationTemplate={template}
          onChange={handleChange}
          tab={tab}
        />
        {annotationsCount > 0 && (
          <Typography
            variant="body2"
            sx={{ px: 2, py: 1.5, color: "text.secondary" }}
          >
            {hintS}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
