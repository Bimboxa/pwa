import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import {
  LocationPin as Marker,
  Polyline,
  Pentagon,
  Rectangle,
  HorizontalRule,
} from "@mui/icons-material";

import { Box, Typography } from "@mui/material";

import AnnotationIcon from "./AnnotationIcon";

import FieldOptionKeyFromIconsVariantToolbar from "Features/form/components/FieldOptionKeyFromIconsVariantToolbar";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldColorVariantToolbar from "Features/form/components/FieldColorVariantToolbar";
import FieldIconVariantToolbar from "Features/form/components/FieldIconVariantToolbar";

export default function FormAnnotationTemplateVariantBlock({
  annotationTemplate,
  onChange,
}) {
  // strings

  const typeS = "Type d'objet";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // helpers - item

  const { type, fillColor, strokeColor, iconKey, label, closeLine } =
    annotationTemplate ?? {};

  // helpers - annotationTypes

  const annotationTypes = [
    { key: "MARKER", icon: <Marker />, label: "Repère" },
    { key: "SEGMENT", icon: <HorizontalRule />, label: "Segment" },
    { key: "POLYLINE", icon: <Polyline />, label: "Ligne" },
    { key: "POLYGON", icon: <Pentagon />, label: "Surface" },
    { key: "RECTANGLE", icon: <Rectangle />, label: "Rectangle" },
  ];

  // helpers

  const optionKey = type === "POLYLINE" && closeLine ? "POLYGON" : type;

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1 }}>
        <Typography variant="body2">{typeS}</Typography>
        <FieldOptionKeyFromIconsVariantToolbar
          value={optionKey}
          onChange={handleTypeChange}
          valueOptions={annotationTypes}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1 }}>
        {type === "MARKER" ? (
          <FieldIconVariantToolbar
            value={iconKey}
            onChange={handleIconKeyChange}
            spriteImage={spriteImage}
            options={{ fillColor }}
          />
        ) : (
          <AnnotationIcon
            spriteImage={spriteImage}
            annotation={annotationTemplate}
            size={32}
          />
        )}
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
  );
}
