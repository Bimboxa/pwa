import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationHeight from "./FieldAnnotationHeight";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldImageV2 from "Features/form/components/FieldImageV2";
import FieldIcon from "Features/form/components/FieldIcon";
import FieldPointSize from "Features/form/components/FieldPointSize";
import FieldAnnotationTemplateFill from "./FieldAnnotationTemplateFill";
import FieldAnnotationTemplateStroke from "./FieldAnnotationTemplateStroke";
import FieldAnnotationTemplateDrawingShape from "./FieldAnnotationTemplateDrawingShape";
import DRAWING_SHAPES from "Features/annotations/constants/drawingShapes.jsx";
import FieldOptionKeyFromIconsVariantToolbar from "Features/form/components/FieldOptionKeyFromIconsVariantToolbar";
import FieldQty from "Features/form/components/FieldQty";
import FieldCheck from "Features/form/components/FieldCheck";
import OverrideToggle from "./OverrideToggle";

import { Circle, Square } from "@mui/icons-material";

import getImageAnnotationPropsFromFileName from "../utils/getImageAnnotationPropsFromFileName";
import {
  getConfigurableProps,
  getDefaultsForShape,
  resolveDrawingShape,
} from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolsByShape } from "Features/mapEditor/constants/drawingTools.jsx";

export default function FormAnnotationTemplateVariantBlock({
  annotationTemplate,
  onChange,
}) {
  // strings

  const qtyS = "Quantité principale";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const isCreating = !annotationTemplate?.id;
  const drawingShape = resolveDrawingShape(annotationTemplate);
  const configurableProps = getConfigurableProps(drawingShape);

  const {
    fillColor,
    fillType = "SOLID",
    fillOpacity = 1,
    strokeColor,
    strokeType = "SOLID",
    strokeOpacity = 1,
    strokeWidth = 2,
    strokeWidthUnit = "PX",
    strokeOffset = null,
    iconKey,
    label,
    labelLegend,
    groupLabel,
    height,
    image,
    meterByPx,
    variant,
    size,
    sizeUnit,
    mainQtyKey,
    defaultTool,
    overrideFields,
  } = annotationTemplate ?? {};

  // derived values for field components

  const fill = { fillColor, fillType, fillOpacity };
  const stroke = {
    strokeColor,
    strokeType,
    strokeOpacity,
    strokeWidth,
    strokeWidthUnit,
    strokeOffset: strokeOffset === 0 ? true : false,
  };
  const point = { fillColor, variant, size, sizeUnit };

  const pointVariants = [
    { key: "SQUARE", icon: <Square fontSize="small" />, label: "Carré" },
    { key: "CIRCLE", icon: <Circle fontSize="small" />, label: "Cercle" },
  ];

  // helpers — which field groups to show based on configurable props

  const shapeTools = getDrawingToolsByShape(drawingShape);
  const toolOptions = shapeTools.map(({ key, label, Icon }) => ({
    key,
    label,
    icon: <Icon fontSize="small" />,
  }));
  const hasTools = shapeTools.length > 1;

  const hasFill =
    configurableProps.includes("fillColor") ||
    configurableProps.includes("fillOpacity") ||
    configurableProps.includes("fillType");
  const hasStroke =
    configurableProps.includes("strokeColor") ||
    configurableProps.includes("strokeWidth");
  const hasIcon = configurableProps.includes("iconKey");
  const hasVariant = configurableProps.includes("variant");
  const hasSize = configurableProps.includes("size");
  const hasImage = configurableProps.includes("image");
  const hasMeterByPx = configurableProps.includes("meterByPx");

  // For simple shapes (MARKER, LABEL, TEXT, POINT), show a simple color field
  // For complex shapes (POLYLINE, POLYGON), show full fill/stroke fields
  const useSimpleFillColor =
    hasFill && !configurableProps.includes("fillOpacity");

  // handlers

  function handleDrawingShapeChange(newDrawingShape) {
    const defaults = getDefaultsForShape(newDrawingShape);
    onChange({
      ...annotationTemplate,
      drawingShape: newDrawingShape,
      ...defaults,
    });
  }

  function handleFillColorChange(fillColor) {
    onChange({ ...annotationTemplate, fillColor });
  }

  function handleIconKeyChange(iconKey) {
    onChange({ ...annotationTemplate, iconKey });
  }

  function handleLabelChange(label) {
    onChange({ ...annotationTemplate, label });
  }

  function handleLabelLegendChange(labelLegend) {
    onChange({ ...annotationTemplate, labelLegend });
  }

  function handleGroupLabelChange(groupLabel) {
    onChange({ ...annotationTemplate, groupLabel });
  }

  function handleHeightChange(height) {
    onChange({ ...annotationTemplate, height });
  }

  function handleImageChange(image) {
    const { label, meterByPx } = getImageAnnotationPropsFromFileName(
      image.fileName
    );
    const newAnnotationTemplate = { ...annotationTemplate, image };
    if (!newAnnotationTemplate.label && label)
      newAnnotationTemplate.label = label;
    if (!newAnnotationTemplate.meterByPx && meterByPx)
      newAnnotationTemplate.meterByPx = meterByPx;
    onChange(newAnnotationTemplate);
  }

  function handleMeterByPxChange(meterByPx) {
    onChange({ ...annotationTemplate, meterByPx });
  }

  function handleFillChange(fill) {
    onChange({ ...annotationTemplate, ...fill });
  }

  function handleStrokeChange(stroke) {
    onChange({ ...annotationTemplate, ...stroke });
  }

  function handlePointChange(point) {
    onChange({ ...annotationTemplate, ...point });
  }

  function handlePointVariantChange(variant) {
    onChange({ ...annotationTemplate, variant });
  }

  function handleDefaultToolChange(defaultTool) {
    onChange({ ...annotationTemplate, defaultTool });
  }

  function handleMainQtyKeyChange(mainQtyKey) {
    onChange({ ...annotationTemplate, mainQtyKey });
  }

  function handleHiddenChange(hidden) {
    onChange({ ...annotationTemplate, hidden });
  }

  function handleOverrideFieldsChange(newOverrideFields) {
    onChange({ ...annotationTemplate, overrideFields: newOverrideFields });
  }

  function handleToggleOverride(field) {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const index = current.indexOf(field);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(field);
    }
    handleOverrideFieldsChange(current);
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        width: 1,
        p: 1,
      }}
    >
      <FieldTextV2
        label="Libellé"
        value={label}
        onChange={handleLabelChange}
        options={{
          fullWidth: true,
          placeholder: "Libellé",
          showAsSection: "true",
        }}
      />

      <FieldTextV2
        label="Libellé légende"
        value={labelLegend}
        onChange={handleLabelLegendChange}
        options={{
          fullWidth: true,
          placeholder: "Libellé légende",
          showAsSection: true,
        }}
      />

      <FieldTextV2
        label="Groupe"
        value={groupLabel}
        onChange={handleGroupLabelChange}
        options={{
          fullWidth: true,
          placeholder: "Groupe",
          showAsSection: true,
        }}
      />

      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
          Forme 2D
        </Typography>
        <FieldOptionKeyFromIconsVariantToolbar
          value={drawingShape}
          onChange={handleDrawingShapeChange}
          valueOptions={DRAWING_SHAPES}
        />
        <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
          <OverrideToggle
            field="height"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <FieldAnnotationHeight
            annotation={annotationTemplate}
            onChange={(updated) => handleHeightChange(updated.height)}
            label="Hauteur"
          />
        </Box>
      </WhiteSectionGeneric>

      {/* Simple fill color (MARKER, LABEL, TEXT, POINT) */}
      {useSimpleFillColor && (
        <Box sx={{ display: "flex", alignItems: "flex-start" }}>
          <OverrideToggle
            field="fillColor"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box sx={{ flex: 1 }}>
            <FieldColorV2
              label="Couleur"
              value={fillColor}
              onChange={handleFillColorChange}
              options={{ showAsSection: true }}
            />
          </Box>
        </Box>
      )}

      {/* Full fill controls (POLYGON) */}
      {hasFill && !useSimpleFillColor && (
        <FieldAnnotationTemplateFill
          value={fill}
          onChange={handleFillChange}
          overrideFields={overrideFields}
          onOverrideFieldsChange={handleOverrideFieldsChange}
        />
      )}

      {/* Stroke controls (POLYLINE) */}
      {hasStroke && (
        <FieldAnnotationTemplateStroke
          value={stroke}
          onChange={handleStrokeChange}
          overrideFields={overrideFields}
          onOverrideFieldsChange={handleOverrideFieldsChange}
        />
      )}

      {/* Icon selector (MARKER) */}
      {hasIcon && (
        <Box sx={{ display: "flex", alignItems: "flex-start" }}>
          <OverrideToggle
            field="iconKey"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box sx={{ flex: 1 }}>
            <FieldIcon
              label="Icône"
              value={iconKey}
              onChange={handleIconKeyChange}
              spriteImage={spriteImage}
              options={{ iconColor: fillColor, showAsSection: true }}
            />
          </Box>
        </Box>
      )}

      {/* Point variant selector (POINT) */}
      {hasVariant && (
        <Box sx={{ display: "flex", alignItems: "flex-start" }}>
          <OverrideToggle
            field="variant"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box sx={{ flex: 1 }}>
            <FieldOptionKeyFromIconsVariantToolbar
              label="Forme"
              value={variant}
              onChange={handlePointVariantChange}
              valueOptions={pointVariants}
              options={{ showAsSection: true, inline: true }}
            />
          </Box>
        </Box>
      )}

      {/* Point size (POINT) */}
      {hasSize && (
        <Box sx={{ display: "flex", alignItems: "flex-start" }}>
          <OverrideToggle
            field="size"
            overrideFields={overrideFields}
            onToggle={handleToggleOverride}
          />
          <Box sx={{ flex: 1 }}>
            <FieldPointSize
              value={point}
              onChange={handlePointChange}
              label="Dimension"
            />
          </Box>
        </Box>
      )}

      {/* Image fields (IMAGE) */}
      {hasImage && (
        <Box sx={{ width: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, p: 1 }}>
              <FieldTextV2
                value={label}
                onChange={handleLabelChange}
                options={{
                  fullWidth: true,
                  placeholder: "Libellé",
                }}
              />
            </Box>
            {hasMeterByPx && (
              <Box sx={{ width: "130px", minWidth: 0, p: 1 }}>
                <FieldTextV2
                  value={meterByPx}
                  onChange={handleMeterByPxChange}
                  options={{
                    fullWidth: true,
                    placeholder: "Echelle m/px",
                    isNumber: true,
                  }}
                />
              </Box>
            )}
          </Box>
          <FieldImageV2 value={image} onChange={handleImageChange} />
        </Box>
      )}

      {hasTools && (
        <FieldOptionKeyFromIconsVariantToolbar
          value={defaultTool}
          onChange={handleDefaultToolChange}
          valueOptions={toolOptions}
          label="Outil par défaut"
          options={{ showAsSection: true }}
        />
      )}

      <FieldQty
        value={mainQtyKey}
        onChange={handleMainQtyKeyChange}
        label={qtyS}
        options={{ showAsSection: true }}
        drawingShape={drawingShape}
      />

      {!isCreating && (
        <FieldCheck
          label="Masquer les annotations"
          value={annotationTemplate?.hidden}
          onChange={handleHiddenChange}
          options={{ showAsSection: true }}
        />
      )}
    </Box>
  );
}
