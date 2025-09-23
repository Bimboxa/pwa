import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setTempAnnotationTemplateLabel } from "../annotationsSlice";

import MarkerIcon from "Features/markers/components/MarkerIcon";

import { Box, Typography, InputBase, TextField } from "@mui/material";

import getAnnotationTemplateIdFromAnnotation from "../utils/getAnnotationTemplateIdFromAnnotation";

export default function BlockAnnotation({
  annotation,
  spriteImage,
  annotationTemplates,
}) {
  const dispatch = useDispatch();

  // strings

  const placeholder = "Libellé";

  // state

  const [tempLabel, setTempLabel] = useState("");

  // helpers

  const templateId = getAnnotationTemplateIdFromAnnotation(annotation);
  const template = annotationTemplates?.find((t) => t.id === templateId);

  // effect - tempLabel

  useEffect(() => {
    console.log("test", template, annotationTemplates, templateId);
    setTempLabel(template?.label ?? "");
  }, [templateId]);

  // helpers - marker icon

  const iconKey = annotation?.iconKey;
  const fillColor = annotation?.fillColor;

  // handlers

  function handleLabelChange(label) {
    setTempLabel(label);
    dispatch(setTempAnnotationTemplateLabel(label));
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <MarkerIcon
        iconKey={iconKey}
        spriteImage={spriteImage}
        size={24}
        fillColor={fillColor}
      />

      <TextField
        sx={{
          ml: 1,
          "& .MuiOutlinedInput-root": {
            "& fieldset": { border: "none" }, // default
            "&:hover fieldset": { border: "none" }, // hover
            "&.Mui-focused fieldset": { border: "none" },
          },
        }}
        size="small"
        value={tempLabel}
        onChange={(e) => handleLabelChange(e.target.value)}
        placeholder={placeholder}
        readOnly={Boolean(template)}
      />
    </Box>
  );
}
