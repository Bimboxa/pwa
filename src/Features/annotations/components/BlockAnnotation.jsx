import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

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

  // data

  const tempAnnotationTemplateLabel = useSelector(
    (s) => s.annotations.tempAnnotationTemplateLabel
  );

  // helpers

  const templateId = annotation?.annotationTemplateId;
  const template = annotationTemplates?.find((t) => t.id === templateId);

  // effect - tempLabel

  const newLabel =
    tempAnnotationTemplateLabel &&
    template?.label !== tempAnnotationTemplateLabel;

  let templateLabel = templateId
    ? template?.label
    : tempAnnotationTemplateLabel;
  if (newLabel && tempAnnotationTemplateLabel)
    templateLabel = tempAnnotationTemplateLabel;

  console.log("newLabel", tempAnnotationTemplateLabel);

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
      <Typography sx={{ ml: 1 }}>{templateLabel}</Typography>
      {/* <TextField
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
        //readOnly={true}
        //readOnly={Boolean(template)}
      /> */}
    </Box>
  );
}
