import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldAnnotationHeight from "./FieldAnnotationHeight";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldImageV2 from "Features/form/components/FieldImageV2";
import FieldObject3D from "Features/object3D/components/FieldObject3D";
import FieldIcon from "Features/form/components/FieldIcon";
import FieldAnnotationTemplateFill from "./FieldAnnotationTemplateFill";
import FieldAnnotationTemplatePoint from "./FieldAnnotationTemplatePoint";
import FieldAnnotationTemplateStroke from "./FieldAnnotationTemplateStroke";
import FieldAnnotationTemplateDrawingShape from "./FieldAnnotationTemplateDrawingShape";
import DRAWING_SHAPES from "Features/annotations/constants/drawingShapes.jsx";
import FieldOptionKeyFromIconsVariantToolbar from "Features/form/components/FieldOptionKeyFromIconsVariantToolbar";
import FieldOptionKey from "Features/form/components/FieldOptionKey";
import FieldQty from "Features/form/components/FieldQty";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldMappingCategories from "./FieldMappingCategories";
import FieldProcedure from "./FieldProcedure";
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
    hiddenInLegend,
    groupLabel,
    height,
    image,
    object3D,
    meterByPx,
    variant,
    size,
    sizeUnit,
    mainQtyKey,
    defaultTool,
    overrideFields,
    unit = "CM",
    extensionOffset = 0,
    extensionOffsetUnit = "PX",
    decimals = 0,
    fontSize = 18,
    showUnitLabel = false,
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
  const hasHeight = configurableProps.includes("height");
  const hasImage = configurableProps.includes("image");
  const hasObject3D = configurableProps.includes("object3D");
  const hasMeterByPx = configurableProps.includes("meterByPx");
  const hasCoteProps = configurableProps.includes("unit");
  const hasShowSlope = configurableProps.includes("showSlope");

  const coteUnitOptions = [
    { key: "MM", label: "Millimètres (mm)" },
    { key: "CM", label: "Centimètres (cm)" },
    { key: "M", label: "Mètres (m)" },
  ];
  const offsetUnitOptions = [
    { key: "PX", label: "Pixels (px)" },
    { key: "CM", label: "Centimètres (cm)" },
  ];

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

  function handleHiddenInLegendChange(hiddenInLegend) {
    onChange({ ...annotationTemplate, hiddenInLegend });
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

  function handleObject3DChange(object3D) {
    onChange({ ...annotationTemplate, object3D });
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

  function handleDefaultToolChange(defaultTool) {
    onChange({ ...annotationTemplate, defaultTool });
  }

  function handleMainQtyKeyChange(mainQtyKey) {
    onChange({ ...annotationTemplate, mainQtyKey });
  }

  function handleHiddenChange(hidden) {
    onChange({ ...annotationTemplate, hidden });
  }

  function handleIsProfileChange(isProfile) {
    onChange({ ...annotationTemplate, isProfile });
  }

  function handleOverrideFieldsChange(newOverrideFields) {
    onChange({ ...annotationTemplate, overrideFields: newOverrideFields });
  }

  function handleUnitChange(unit) {
    onChange({ ...annotationTemplate, unit });
  }

  function handleExtensionOffsetChange(value) {
    const parsed = value === "" || value === null ? 0 : Number(value);
    onChange({
      ...annotationTemplate,
      extensionOffset: Number.isFinite(parsed) ? parsed : 0,
    });
  }

  function handleExtensionOffsetUnitChange(extensionOffsetUnit) {
    onChange({ ...annotationTemplate, extensionOffsetUnit });
  }

  function handleDecimalsChange(value) {
    const parsed = value === "" || value === null ? 0 : Number(value);
    const clamped = Math.max(0, Math.min(6, Math.floor(parsed)));
    onChange({
      ...annotationTemplate,
      decimals: Number.isFinite(clamped) ? clamped : 0,
    });
  }

  function handleFontSizeChange(value) {
    const parsed = value === "" || value === null ? 18 : Number(value);
    onChange({
      ...annotationTemplate,
      fontSize: Number.isFinite(parsed) && parsed > 0 ? parsed : 18,
    });
  }

  function handleShowUnitLabelChange(showUnitLabel) {
    onChange({ ...annotationTemplate, showUnitLabel });
  }

  function handleShowSlopeChange(showSlope) {
    onChange({ ...annotationTemplate, showSlope });
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

      {!isCreating && (
        <WhiteSectionGeneric>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }} noWrap>
            Libellé légende
          </Typography>
          <FieldTextV2
            value={labelLegend}
            onChange={handleLabelLegendChange}
            options={{
              fullWidth: true,
              placeholder: "Libellé légende",
            }}
          />
          <FieldCheck
            value={hiddenInLegend}
            onChange={handleHiddenInLegendChange}
            label="Masquer le titre dans le bloc légende"
            options={{ type: "check" }}
          />
        </WhiteSectionGeneric>
      )}

      {!isCreating && (
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
      )}

      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
          Forme 2D
        </Typography>
        <FieldOptionKeyFromIconsVariantToolbar
          value={drawingShape}
          onChange={handleDrawingShapeChange}
          valueOptions={DRAWING_SHAPES}
        />
      </WhiteSectionGeneric>

      {/* Height (POLYLINE, POINT) */}
      {hasHeight && (
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", alignItems: "center" }}>
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
      )}

      {/* Simple fill color (MARKER, LABEL, TEXT) */}
      {useSimpleFillColor && drawingShape !== "POINT" && (
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

      {/* Slope indicator toggle (POLYGON) */}
      {hasShowSlope && drawingShape === "POLYGON" && (
        <FieldCheck
          label="Afficher la pente"
          value={Boolean(annotationTemplate?.showSlope)}
          onChange={handleShowSlopeChange}
          options={{ type: "switch", showAsSection: true }}
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

      {/* COTE-specific controls */}
      {hasCoteProps && (
        <WhiteSectionGeneric>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Cote
          </Typography>
          <FieldOptionKey
            label="Unité"
            value={unit}
            onChange={handleUnitChange}
            valueOptions={coteUnitOptions}
          />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
            <Box sx={{ flex: 1 }}>
              <FieldTextV2
                label="Décalage extrémités"
                value={extensionOffset}
                onChange={handleExtensionOffsetChange}
                options={{ fullWidth: true, isNumber: true }}
              />
            </Box>
            <Box sx={{ width: 120 }}>
              <FieldOptionKey
                value={extensionOffsetUnit}
                onChange={handleExtensionOffsetUnitChange}
                valueOptions={offsetUnitOptions}
              />
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Box sx={{ flex: 1 }}>
              <FieldTextV2
                label="Décimales"
                value={decimals}
                onChange={handleDecimalsChange}
                options={{ fullWidth: true, isNumber: true }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <FieldTextV2
                label="Taille texte (px)"
                value={fontSize}
                onChange={handleFontSizeChange}
                options={{ fullWidth: true, isNumber: true }}
              />
            </Box>
          </Box>
          <FieldCheck
            label="Afficher l'unité après la valeur"
            value={Boolean(showUnitLabel)}
            onChange={handleShowUnitLabelChange}
            options={{ type: "check" }}
          />
        </WhiteSectionGeneric>
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

      {/* Point properties — color, variant, size grouped in one section (POINT) */}
      {drawingShape === "POINT" && (
        <FieldAnnotationTemplatePoint
          value={point}
          onChange={handlePointChange}
          overrideFields={overrideFields}
          onOverrideFieldsChange={handleOverrideFieldsChange}
          variantOptions={pointVariants}
        />
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

      {/* Object 3D field (OBJECT_3D) */}
      {hasObject3D && (
        <FieldObject3D value={object3D} onChange={handleObject3DChange} />
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
        <FieldMappingCategories
          annotationTemplate={annotationTemplate}
          onChange={onChange}
        />
      )}

      {!isCreating && (
        <FieldProcedure
          annotationTemplate={annotationTemplate}
          onChange={onChange}
        />
      )}

      {!isCreating && (
        <FieldCheck
          label="Masquer les annotations"
          value={annotationTemplate?.hidden}
          onChange={handleHiddenChange}
          options={{ showAsSection: true }}
        />
      )}

      {drawingShape === "POLYLINE" && (
        <FieldCheck
          label="Profil"
          value={Boolean(annotationTemplate?.isProfile)}
          onChange={handleIsProfileChange}
          options={{ type: "switch", showAsSection: true }}
        />
      )}
    </Box>
  );
}
