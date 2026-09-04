import { useState } from "react";

import { Box, Typography, Chip, Collapse } from "@mui/material";
import { ExpandMore } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldAnnotationTemplateFill from "Features/annotations/components/FieldAnnotationTemplateFill";
import FieldAnnotationTemplateStroke from "Features/annotations/components/FieldAnnotationTemplateStroke";
import FieldAnnotationTemplateStrokeWidth from "Features/annotations/components/FieldAnnotationTemplateStrokeWidth";
import {
  resolveDrawingShape,
  getShapeConfig,
  getConfigurableProps,
} from "Features/annotations/constants/drawingShapeConfig";

// One template in the système flow: a compact header (swatch + label + shape)
// that expands to a restricted editor. Système templates only expose their
// visual props (label / fill / stroke): the structural fields the procedure
// relies on (mapping categories, shape, tools, procedure keys…) stay hidden
// and untouched.
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

  // Editable visual props, gated by what the shape actually supports (same
  // rule as the full template editor).
  const configurableProps = getConfigurableProps(drawingShape);
  const hasFill = ["fillColor", "fillType", "fillOpacity"].some((key) =>
    configurableProps.includes(key)
  );
  const hasStroke = configurableProps.includes("strokeColor");
  const hasStrokeWidth = configurableProps.includes("strokeWidth");
  // Simple shapes (MARKER, LABEL, TEXT, POINT) get a single color field.
  const useSimpleFillColor =
    hasFill && !configurableProps.includes("fillOpacity");

  const {
    fillColor,
    fillType = "SOLID",
    fillOpacity = 1,
    strokeColor,
    strokeType = "SOLID",
    strokeOpacity = 1,
    strokeWidth = 2,
    strokeWidthUnit = "PX",
  } = template;

  // handlers

  function patch(partial) {
    onChange({ ...template, ...partial });
  }

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
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {shapeLabel}
          </Typography>
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
            display: "flex",
            flexDirection: "column",
            gap: 1,
            p: 1,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: "background.default",
          }}
        >
          <FieldTextV2
            label="Libellé"
            value={template.label ?? ""}
            onChange={(label) => patch({ label })}
            options={{
              fullWidth: true,
              placeholder: "Libellé",
              showAsField: true,
            }}
          />

          {useSimpleFillColor && (
            <FieldColorV2
              label="Couleur"
              value={fillColor}
              onChange={(color) => patch({ fillColor: color })}
              options={{ showAsSection: true }}
            />
          )}

          {hasFill && !useSimpleFillColor && (
            <FieldAnnotationTemplateFill
              value={{ fillColor, fillType, fillOpacity }}
              onChange={(fill) => patch(fill)}
            />
          )}

          {hasStroke && (
            <FieldAnnotationTemplateStroke
              value={{
                strokeColor,
                strokeType,
                strokeOpacity,
                strokeWidthUnit,
              }}
              onChange={(stroke) => patch(stroke)}
            />
          )}

          {hasStrokeWidth && (
            <FieldAnnotationTemplateStrokeWidth
              value={{ strokeWidth, strokeWidthUnit }}
              onChange={(width) => patch(width)}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
