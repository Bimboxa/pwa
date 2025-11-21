import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import {
  LocationPin as Marker,
  Polyline,
  Pentagon,
  Rectangle,
  HorizontalRule,
  Image,
  TextFields,
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
import FieldCheck from "Features/form/components/FieldCheck";

import getImageAnnotationPropsFromFileName from "../utils/getImageAnnotationPropsFromFileName";

export default function FormAnnotationTemplateVariantBlock({
  annotationTemplate,
  onChange,
}) {
  // strings

  const typeS = "Type d'objet";

  // data

  const spriteImage = useAnnotationSpriteImage();

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

  // helpers - annotationTypes

  const annotationTypes = [
    { key: "MARKER", icon: <Marker />, label: "Repère" },
    //{ key: "SEGMENT", icon: <HorizontalRule />, label: "Segment" },
    { key: "POLYLINE", icon: <Polyline />, label: "Ligne" },
    { key: "POLYGON", icon: <Pentagon />, label: "Surface" },
    { key: "RECTANGLE", icon: <Rectangle />, label: "Rectangle" },
    { key: "IMAGE", icon: <Image />, label: "Image" },
    { key: "TEXT", icon: <TextFields />, label: "Texte" },
  ];

  // helpers

  const optionKey = type === "POLYLINE" && closeLine ? "POLYGON" : type;

  // helpers - show fill and stroke

  const showFill = (type === "POLYLINE" && closeLine) || type === "RECTANGLE";
  const showStroke = type !== "MARKER";

  // handlers

  function handleTypeChange(type) {
    onChange({
      ...annotationTemplate,
      type: type === "POLYGON" ? "POLYLINE" : type,
      closeLine: type === "POLYGON",
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

  function handleCutHostChange(cutHost) {
    onChange({ ...annotationTemplate, cutHost });
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 1,
        }}
      >
        {/* <Typography variant="body2">{typeS}</Typography> */}
        <FieldOptionKeyFromIconsVariantToolbar
          value={optionKey}
          onChange={handleTypeChange}
          valueOptions={annotationTypes}
        />
      </Box>

      {type === "TEXT" && (
        <Box>
          <FieldTextV2
            value={label}
            onChange={handleLabelChange}
            options={{ fullWidth: true, placeholder: "Libellé" }}
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
      {type === "MARKER" && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1 }}>
            <FieldIconVariantToolbar
              value={iconKey}
              onChange={handleIconKeyChange}
              spriteImage={spriteImage}
              options={{ fillColor }}
            />

            <Box sx={{ flex: 1 }}>
              <FieldTextV2
                value={label}
                onChange={handleLabelChange}
                options={{ fullWidth: true, placeholder: "Libellé" }}
              />
            </Box>
            <FieldColorVariantToolbar
              value={fillColor}
              onChange={handleFillColorChange}
            />
          </Box>
        </Box>
      )}

      {["SEGMENT", "POLYLINE", "POLYGON", "RECTANGLE"].includes(type) && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1 }}>
            <AnnotationIcon
              spriteImage={spriteImage}
              annotation={annotationTemplate}
              size={32}
            />

            <Box sx={{ flex: 1 }}>
              <FieldTextV2
                value={label}
                onChange={handleLabelChange}
                options={{ fullWidth: true, placeholder: "Libellé" }}
              />
            </Box>
          </Box>

          {showFill && (
            <Box
              sx={{
                width: 1,
                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                p: 2,
              }}
            >
              <FieldFill value={fill} onChange={handleFillChange} />
            </Box>
          )}

          {showStroke && (
            <Box
              sx={{
                width: 1,
                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                p: 2,
              }}
            >
              <FieldStroke value={stroke} onChange={handleStrokeChange} />
            </Box>
          )}

          <Box>
            <FieldCheck
              value={cutHost}
              onChange={handleCutHostChange}
              label="Couper l'hôte"
              options={{
                type: "switch",
                showAsSection: true,
              }}
            />
          </Box>
        </Box>
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
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
    </Box>
  );
}
