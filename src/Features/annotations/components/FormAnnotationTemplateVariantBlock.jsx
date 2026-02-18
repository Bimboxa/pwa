import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import {
  LocationPin as Marker,
  Polyline,
  Pentagon,
  Rectangle,
  HorizontalRule,
  LabelOutlined as Label,
  Image,
  TextFields,
  Circle,
  StackedLineChart as Strip,
  Square,
} from "@mui/icons-material";

import { Box, Typography } from "@mui/material";

import AnnotationIcon from "./AnnotationIcon";

import FieldOptionKeyFromIconsVariantToolbar from "Features/form/components/FieldOptionKeyFromIconsVariantToolbar";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldColorVariantToolbar from "Features/form/components/FieldColorVariantToolbar";
import FieldIconVariantToolbar from "Features/form/components/FieldIconVariantToolbar";
import FieldImageV2 from "Features/form/components/FieldImageV2";
import FieldFill from "Features/form/components/FieldFill";
import FieldStroke from "Features/form/components/FieldStroke";
import FieldPoint from "Features/form/components/FieldPointSize";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldSizeAndUnit from "Features/form/components/FieldSizeAndUnit";
import FieldQty from "Features/form/components/FieldQty";

import getImageAnnotationPropsFromFileName from "../utils/getImageAnnotationPropsFromFileName";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldIcon from "Features/form/components/FieldIcon";
import FieldPointSize from "Features/form/components/FieldPointSize";

export default function FormAnnotationTemplateVariantBlock({
  annotationTemplate,
  onChange,
}) {
  // strings

  const typeS = "Type d'objet";
  const qtyS = "Quantité principale";
  const annotationTypeS = "Type de forme";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // helper

  const isCreating = !annotationTemplate?.id

  // helpers - item

  const {
    type,
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
    closeLine,
    image,
    meterByPx,
    cutHost,
    variant,
    size,
    sizeUnit,
    mainQtyKey,

  } = annotationTemplate ?? {};

  // helper - fill

  const fill = { fillColor, fillType, fillOpacity };
  const stroke = {
    strokeColor,
    strokeType,
    strokeOpacity,
    strokeWidth,
    strokeWidthUnit,
    strokeOffset: strokeOffset === 0 ? true : false,
  };

  const point = {
    fillColor,
    variant,
    size,
    sizeUnit,
  };

  const pointSize = {
    size,
    sizeUnit
  }

  const sizeAndUnit = {
    size,
    sizeUnit,
  };


  // helpers - annotationTypes

  const annotationTypes = [
    { key: "LABEL", icon: <Label fontSize="small" />, label: "Etiquette" },
    { key: "MARKER", icon: <Marker fontSize="small" />, label: "Repère" },
    { key: "POINT", icon: <Circle fontSize="small" />, label: "Point" },
    //{ key: "SEGMENT", icon: <HorizontalRule />, label: "Segment" },
    { key: "POLYLINE", icon: <Polyline fontSize="small" />, label: "Ligne" },
    { key: "STRIP", icon: <Strip fontSize="small" />, label: "Bande" },
    { key: "POLYGON", icon: <Pentagon fontSize="small" />, label: "Surface" },
    { key: "RECTANGLE", icon: <Rectangle fontSize="small" />, label: "Rectangle" },
    { key: "IMAGE", icon: <Image fontSize="small" />, label: "Image" },
    // { key: "TEXT", icon: <TextFields fontSize="small" />, label: "Texte" },
  ];

  const pointVariants = [
    { key: "SQUARE", icon: <Square fontSize="small" />, label: "Carré" },
    { key: "CIRCLE", icon: <Circle fontSize="small" />, label: "Cercle" },
  ]

  // helpers

  //const optionKey = type === "POLYLINE" && closeLine ? "POLYGON" : type;
  const optionKey = type;

  // helpers - show fill and stroke

  const showFill = ["RECTANGLE", "POLYGON"].includes(type);
  const showStroke = ["POLYLINE", "STRIP"].includes(type);

  // handlers

  function handleTypeChange(type) {
    onChange({
      ...annotationTemplate,
      type,
      //type: type === "POLYGON" ? "POLYLINE" : type,
      //closeLine: type === "POLYGON",
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
    onChange({ ...annotationTemplate, variant })
  }

  function handlePointSizeChange(pointSize) {
    onChange({ ...annotationTemplate, ...pointSize })
  }

  function handleCutHostChange(cutHost) {
    onChange({ ...annotationTemplate, cutHost });
  }

  function handleSizeAndUnitChange(sizeAndUnit) {
    onChange({ ...annotationTemplate, ...sizeAndUnit });
  }

  function handleMainQtyKeyChange(mainQtyKey) {
    onChange({ ...annotationTemplate, mainQtyKey });
  }

  function handleHiddenChange(hidden) {
    onChange({ ...annotationTemplate, hidden })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: 1, p: 1 }}>

      <FieldTextV2
        label="Libellé"
        value={label}
        onChange={handleLabelChange}
        options={{ fullWidth: true, placeholder: "Libellé", showAsSection: "true" }}
      />

      {/* <Typography variant="body2">{typeS}</Typography> */}
      <FieldOptionKeyFromIconsVariantToolbar
        label={annotationTypeS}
        value={optionKey}
        onChange={handleTypeChange}
        valueOptions={annotationTypes}
        options={{ showAsSection: true }}
      />


      {type === "TEXT" && (
        <Box>
          <FieldTextV2
            value={label}
            onChange={handleLabelChange}
            options={{ fullWidth: true, placeholder: "Libellé", showAsSection: true }}
          />
          <Box
            sx={{
              width: 1,
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              p: 2,
            }}
          >
            <FieldFill value={fill} onChange={handleFillChange} />
          </Box>
        </Box>
      )}

      {type === "LABEL" && (

        <FieldColorV2
          value={fillColor}
          onChange={handleFillColorChange}
          label="Couleur"
          options={{ showAsSection: true }}
        />


      )}

      {type === "MARKER" && (
        <>
          <FieldColorV2
            label="Couleur"
            value={fillColor}
            onChange={handleFillColorChange}
            options={{ showAsSection: true }}
          />
          <FieldIcon
            label="Icône"
            value={iconKey}
            onChange={handleIconKeyChange}
            spriteImage={spriteImage}
            options={{ iconColor: fillColor, showAsSection: true }}
          />
        </>
      )}

      {type === "POINT" && (
        <>
          <FieldColorV2
            label="Couleur"
            value={fillColor}
            onChange={handleFillColorChange}
            options={{ showAsSection: true }}
          />
          <FieldOptionKeyFromIconsVariantToolbar
            label="Forme"
            value={variant}
            onChange={handlePointVariantChange}
            valueOptions={pointVariants}
            options={{ showAsSection: true, inline: true }}
          />
          <FieldPointSize value={point} onChange={handlePointChange} label="Dimension" />
        </>




      )}

      {["SEGMENT", "POLYLINE", "POLYGON", "STRIP"].includes(type) && (
        <>
          {showFill && (
            <FieldFill value={fill} onChange={handleFillChange} />
          )}

          {showStroke && (
            <FieldStroke value={stroke} onChange={handleStrokeChange} />
          )}

        </>
      )}

      {type === "RECTANGLE" && (
        <>
          <FieldFill value={fill} onChange={handleFillChange} />
          <FieldSizeAndUnit value={sizeAndUnit} onChange={handleSizeAndUnitChange} />
        </>
      )}

      {type === "IMAGE" && (
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
            <Box
              sx={{
                width: "130px",
                minWidth: 0,
                p: 1
              }}
            >
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
          </Box>
          <FieldImageV2 value={image} onChange={handleImageChange} />
        </Box>
      )}

      {!isCreating && <FieldQty value={mainQtyKey} onChange={handleMainQtyKeyChange} label={qtyS} options={{ showAsSection: true }} />}

      {!isCreating && <FieldCheck
        label="Masquer les annotations"
        value={annotationTemplate?.hidden}
        onChange={handleHiddenChange}
        options={{ showAsSection: true }}
      />}




    </Box>
  );
}
