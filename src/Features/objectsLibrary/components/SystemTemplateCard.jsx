import { useState } from "react";

import { Box, Typography, Chip, Collapse } from "@mui/material";
import { ExpandMore } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import FormAnnotationTemplateVariantBlock from "Features/annotations/components/FormAnnotationTemplateVariantBlock";
import {
  resolveDrawingShape,
  getShapeConfig,
} from "Features/annotations/constants/drawingShapeConfig";

// One template in the système flow: a compact header (swatch + label + category +
// shape) that expands to the shared annotationTemplate properties editor. The
// template is passed WITHOUT an `id` (isCreating), so the editor hides the
// structural mapping/procedure sections and only exposes the visual props.
export default function SystemTemplateCard({
  template,
  onChange,
  variant = "generated",
  defaultExpanded = false,
}) {
  // state

  const [expanded, setExpanded] = useState(defaultExpanded);

  // helpers

  if (!template) return null;

  const isSource = variant === "source";
  const drawingShape = resolveDrawingShape(template);
  const shapeLabel = getShapeConfig(drawingShape)?.label ?? drawingShape;
  const category = template.mappingCategories?.[0];

  // render

  return (
    <Box
      sx={{
        border: (theme) =>
          `1px solid ${
            isSource ? theme.palette.primary.main : theme.palette.divider
          }`,
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Box
        onClick={() => setExpanded((e) => !e)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          cursor: "pointer",
          bgcolor: isSource ? "action.hover" : "transparent",
        }}
      >
        <AnnotationTemplateIcon template={template} size={24} use3D={false} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {template.label}
            </Typography>
            {isSource && (
              <Chip size="small" color="primary" label="Annotation de départ" />
            )}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: 0.5,
              flexWrap: "wrap",
            }}
          >
            {category && (
              <Chip
                size="small"
                variant="outlined"
                label={category}
                sx={{
                  height: 20,
                  "& .MuiChip-label": {
                    fontFamily: "monospace",
                    fontSize: 11,
                    px: 1,
                  },
                }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {shapeLabel}
            </Typography>
          </Box>
        </Box>
        <ExpandMore
          sx={{
            color: "text.secondary",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box
          sx={{
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: "background.default",
          }}
        >
          <FormAnnotationTemplateVariantBlock
            annotationTemplate={template}
            onChange={onChange}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
