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
import FieldPoint from "Features/form/components/FieldPoint";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldSizeAndUnit from "Features/form/components/FieldSizeAndUnit";
import FieldQty from "Features/form/components/FieldQty";

import getImageAnnotationPropsFromFileName from "../utils/getImageAnnotationPropsFromFileName";

export default function FormAnnotationTemplateVariantBlock({
  annotationTemplate,
  onChange,
}) {
  // strings

  const typeS = "Type d'objet";
  const qtyS = "Quantité";

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

  const sizeAndUnit = {
    size,
    sizeUnit,
  };


  // helpers - annotationTypes

  const annotationTypes = [
    { key: "LABEL", icon: <Label />, label: "Etiquette" },
    { key: "MARKER", icon: <Marker />, label: "Repère" },
    { key: "POINT", icon: <Circle sx={{ fontSize: 12 }} />, label: "Point" },
    //{ key: "SEGMENT", icon: <HorizontalRule />, label: "Segment" },
    { key: "POLYLINE", icon: <Polyline />, label: "Ligne" },
    { key: "STRIP", icon: <Strip />, label: "Bande" },
    { key: "POLYGON", icon: <Pentagon />, label: "Surface" },
    { key: "RECTANGLE", icon: <Rectangle />, label: "Rectangle" },
    { key: "IMAGE", icon: <Image />, label: "Image" },
    { key: "TEXT", icon: <TextFields />, label: "Texte" },
  ];

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

  function handleCutHostChange(cutHost) {
    onChange({ ...annotationTemplate, cutHost });
  }

  function handleSizeAndUnitChange(sizeAndUnit) {
    onChange({ ...annotationTemplate, ...sizeAndUnit });
  }

  function handleMainQtyKeyChange(mainQtyKey) {
    onChange({ ...annotationTemplate, mainQtyKey });
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
      {type === "LABEL" && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
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
      {type === "MARKER" && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
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

      {type === "POINT" && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
            <AnnotationIcon
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
            <FieldPoint value={point} onChange={handlePointChange} />
          </Box>
        </Box>
      )}

      {["SEGMENT", "POLYLINE", "POLYGON", "STRIP"].includes(type) && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
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

          {/* <Box>
            <FieldCheck
              value={cutHost}
              onChange={handleCutHostChange}
              label="Couper l'hôte"
              options={{
                type: "switch",
                showAsSection: true,
              }}
            />
          </Box> */}
        </Box>
      )}

      {type === "RECTANGLE" && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
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


          <Box
            sx={{
              width: 1,
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              p: 2,
            }}
          >
            <FieldFill value={fill} onChange={handleFillChange} />
          </Box>

          <Box
            sx={{
              width: 1,
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              p: 2,
            }}
          >
            <FieldSizeAndUnit value={sizeAndUnit} onChange={handleSizeAndUnitChange} />
          </Box>


          {/* <Box>
            <FieldCheck
              value={cutHost}
              onChange={handleCutHostChange}
              label="Couper l'hôte"
              options={{
                type: "switch",
                showAsSection: true,
              }}
            />
          </Box> */}
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

      <Box sx={{
        p: 1,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
      }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}> {qtyS}</Typography>
        <FieldQty value={mainQtyKey} onChange={handleMainQtyKeyChange} />
      </Box>
    </Box>
  );
}
