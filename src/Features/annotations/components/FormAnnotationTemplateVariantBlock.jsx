import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import { Box, Typography, Switch } from "@mui/material";

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
import FieldAnnotationTemplateRender3d from "./FieldAnnotationTemplateRender3d";
import FieldAnnotationTemplateLegend from "./FieldAnnotationTemplateLegend";
import FieldAnnotationTemplateDrawingShape from "./FieldAnnotationTemplateDrawingShape";
import FieldAnnotationTemplateDefaultTool from "./FieldAnnotationTemplateDefaultTool";
import FieldAnnotationTemplateCote from "./FieldAnnotationTemplateCote";
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
import { MATERIAL3D_NONE_KEY } from "Features/photorealRender/utils/material3dPresets";
import { getDrawingToolsByShape } from "Features/mapEditor/constants/drawingTools.jsx";

export default function FormAnnotationTemplateVariantBlock({
  annotationTemplate,
  onChange,
  tab,
  compact = false,
}) {
  // strings

  const qtyS = "Quantité principale";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const isCreating = !annotationTemplate?.id;
  const drawingShape = resolveDrawingShape(annotationTemplate);
  const configurableProps = getConfigurableProps(drawingShape);

  // Which tab group to render. When `tab` is undefined (form used outside the
  // properties panel), both groups render together as a single column.
  // `compact` (creation dialog) keeps only the essential fields: label, shape,
  // appearance, height (non-POLYGON shapes) and main quantity.
  const showMain = !tab || tab === "MAIN";
  const showAdvanced = !compact && (!tab || tab === "ADVANCED");

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
    image,
    object3D,
    material3d,
    color3D,
    opacity3D,
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
  const hasHeight = configurableProps.includes("height");
  const hasWidth = configurableProps.includes("width");
  const hasImage = configurableProps.includes("image");
  const hasObject3D = configurableProps.includes("object3D");
  const hasMeterByPx = configurableProps.includes("meterByPx");
  const hasCoteProps = configurableProps.includes("unit");
  const hasHideSlope = configurableProps.includes("hideSlope");
  const hasMaterial3d = configurableProps.includes("material3d");
  const hasRender3d =
    configurableProps.includes("color3D") ||
    configurableProps.includes("opacity3D") ||
    hasMaterial3d;

  // Fallback 2D color/opacity shown as the inherited placeholder in the
  // "Rendu 3D" section (fill-driven for POLYGON, stroke-driven for POLYLINE).
  const render3dFallbackColor = hasFill
    ? fillColor || strokeColor || "#cccccc"
    : strokeColor || fillColor || "#cccccc";
  const render3dFallbackOpacity = hasFill ? fillOpacity : strokeOpacity;

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

  function handleWidthChange(width) {
    onChange({ ...annotationTemplate, width });
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

  function handleIsProfileChange(isProfile) {
    onChange({ ...annotationTemplate, isProfile });
  }

  function handleIsExtChange(isExt) {
    onChange({ ...annotationTemplate, isExt });
  }

  function handleOverrideFieldsChange(newOverrideFields) {
    onChange({ ...annotationTemplate, overrideFields: newOverrideFields });
  }

  function handleHideSlopeChange(hideSlope) {
    onChange({ ...annotationTemplate, hideSlope });
  }

  function handleMaterial3dChange(key) {
    onChange({
      ...annotationTemplate,
      material3d: key === MATERIAL3D_NONE_KEY ? null : key,
    });
  }

  function handleColor3DChange(color3D) {
    onChange({ ...annotationTemplate, color3D });
  }

  function handleOpacity3DChange(opacity3D) {
    onChange({ ...annotationTemplate, opacity3D });
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
      {/* ---- Tab 1 : Principal ---- */}
      {showMain && (
        <>
          <FieldTextV2
            label="Libellé"
            value={label}
            onChange={handleLabelChange}
            options={{
              fullWidth: true,
              placeholder: "Libellé",
              showAsField: true,
            }}
          />

          <FieldAnnotationTemplateDrawingShape
            value={drawingShape}
            onChange={handleDrawingShapeChange}
          />

          {/* Appearance — fill / stroke / simple color / icon / point / image /
              3D object (mutually exclusive per shape) */}

          {/* Simple fill color (MARKER, LABEL, TEXT) */}
          {useSimpleFillColor && drawingShape !== "POINT" && (
            <FieldColorV2
              label="Couleur"
              value={fillColor}
              onChange={handleFillColorChange}
              options={{ showAsSection: true }}
              endAction={
                <OverrideToggle
                  field="fillColor"
                  overrideFields={overrideFields}
                  onToggle={handleToggleOverride}
                />
              }
            />
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
            <FieldIcon
              label="Icône"
              value={iconKey}
              onChange={handleIconKeyChange}
              spriteImage={spriteImage}
              options={{ iconColor: fillColor, showAsSection: true }}
              endAction={
                <OverrideToggle
                  field="iconKey"
                  overrideFields={overrideFields}
                  onToggle={handleToggleOverride}
                />
              }
            />
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

          {/* Extérieur.
              POLYGON is included because its STRIP tools also produce strip
              annotations, which can act as exterior-side guides. */}
          {!compact &&
            ["POLYLINE", "STRIP", "POLYGON"].includes(drawingShape) && (
            <WhiteSectionGeneric>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
                  Extérieur
                </Typography>
                <Switch
                  size="small"
                  checked={Boolean(annotationTemplate?.isExt)}
                  onChange={(e) => handleIsExtChange(e.target.checked)}
                />
                <OverrideToggle
                  field="isExt"
                  overrideFields={overrideFields}
                  onToggle={handleToggleOverride}
                />
              </Box>
            </WhiteSectionGeneric>
          )}

          {/* Width (OPENING) — opening width along the wall */}
          {!compact && hasWidth && (
            <WhiteSectionGeneric>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
                  Largeur
                </Typography>
                <FieldAnnotationHeight
                  annotation={annotationTemplate}
                  field="width"
                  label=""
                  onChange={(updated) => handleWidthChange(updated.width)}
                />
                <OverrideToggle
                  field="width"
                  overrideFields={overrideFields}
                  onToggle={handleToggleOverride}
                />
              </Box>
            </WhiteSectionGeneric>
          )}

          {/* Height / thickness (POLYLINE, POINT, POLYGON).
              In compact mode, only the "Hauteur" variant is kept — the POLYGON
              "Epaisseur" is an advanced setting. */}
          {hasHeight && !(compact && drawingShape === "POLYGON") && (
            <WhiteSectionGeneric>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
                  {drawingShape === "POLYGON" ? "Epaisseur" : "Hauteur"}
                </Typography>
                <FieldAnnotationHeight
                  annotation={annotationTemplate}
                  label=""
                  onChange={(updated) => handleHeightChange(updated.height)}
                />
                <OverrideToggle
                  field="height"
                  overrideFields={overrideFields}
                  onToggle={handleToggleOverride}
                />
              </Box>
            </WhiteSectionGeneric>
          )}

          {!compact && hasTools && (
            <FieldAnnotationTemplateDefaultTool
              value={defaultTool}
              onChange={handleDefaultToolChange}
              options={toolOptions}
            />
          )}

          {/* COTE / RULER controls — one line + "..." popover */}
          {hasCoteProps && (
            <FieldAnnotationTemplateCote
              annotationTemplate={annotationTemplate}
              onChange={onChange}
              overrideFields={overrideFields}
              onOverrideFieldsChange={handleOverrideFieldsChange}
              showTotalOption={drawingShape === "RULER"}
            />
          )}

          {/* RULER is a measurement object: it produces no quantities, so the
              main-quantity selector would be misleading. */}
          {drawingShape !== "RULER" && (
            <FieldQty
              value={mainQtyKey}
              onChange={handleMainQtyKeyChange}
              label={qtyS}
              drawingShape={drawingShape}
            />
          )}
        </>
      )}

      {/* ---- Tab 2 : Avancé ---- */}
      {showAdvanced && (
        <>
          {!isCreating && (
            <FieldAnnotationTemplateLegend
              labelLegend={labelLegend}
              hiddenInLegend={hiddenInLegend}
              groupLabel={groupLabel}
              onLabelLegendChange={handleLabelLegendChange}
              onHiddenInLegendChange={handleHiddenInLegendChange}
              onGroupLabelChange={handleGroupLabelChange}
            />
          )}

          {/* Slope indicator toggle (POLYGON) */}
          {hasHideSlope && drawingShape === "POLYGON" && (
            <FieldCheck
              label="Masquer la pente"
              value={Boolean(annotationTemplate?.hideSlope)}
              onChange={handleHideSlopeChange}
              options={{ type: "switch", showAsField: true }}
            />
          )}

          {/* 3D-only color / opacity overrides + material preset */}
          {hasRender3d && (
            <FieldAnnotationTemplateRender3d
              color3D={color3D}
              opacity3D={opacity3D}
              material3d={material3d}
              fallbackColor={render3dFallbackColor}
              fallbackOpacity={render3dFallbackOpacity}
              hasMaterial3d={hasMaterial3d}
              onColor3DChange={handleColor3DChange}
              onOpacity3DChange={handleOpacity3DChange}
              onMaterial3dChange={handleMaterial3dChange}
            />
          )}

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

          {drawingShape === "POLYLINE" && (
            <FieldCheck
              label="Profil"
              value={Boolean(annotationTemplate?.isProfile)}
              onChange={handleIsProfileChange}
              options={{ type: "switch", showAsField: true }}
            />
          )}
        </>
      )}
    </Box>
  );
}
