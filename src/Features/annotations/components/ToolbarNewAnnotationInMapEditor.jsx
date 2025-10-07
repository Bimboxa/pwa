import { useSelector, useDispatch } from "react-redux";

import {
  setNewAnnotation,
  setTempAnnotationTemplateLabel,
} from "../annotationsSlice";
import {
  setEnabledDrawingMode,
  setSelectedAnnotationTemplateId,
} from "Features/mapEditor/mapEditorSlice";

import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplatesBySelectedListing from "../hooks/useAnnotationTemplatesBySelectedListing";

import { Box } from "@mui/material";
import { LocationPin as Marker, Polyline } from "@mui/icons-material";

import FormVariantToolbar from "Features/form/components/FormVariantToolbar";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import IconButtonClose from "Features/layout/components/IconButtonClose";

import getAnnotationTemplateFromAnnotation from "../utils/getAnnotationTemplateFromAnnotation";

export default function ToolbarNewAnnotationInMapEditor({ onClose }) {
  const dispatch = useDispatch();

  // string

  const createS = "Dessiner";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useAnnotationTemplatesBySelectedListing();
  const { value: listing } = useSelectedListing();
  const tempLabel = useSelector(
    (s) => s.annotations.tempAnnotationTemplateLabel
  );

  // helpers - annotationTypes

  const annotationTypes = [
    { key: "MARKER", icon: <Marker /> },
    { key: "POLYLINE", icon: <Polyline /> },
  ];

  // helper - existing template

  const annotationTemplate = getAnnotationTemplateFromAnnotation({
    annotation: newAnnotation,
    listing,
    annotationTemplates,
  });

  // helper - disable

  const { type, fillColor, iconKey } = newAnnotation ?? {};
  const disabled =
    !tempLabel || !type || (type === "MARKER" && (!fillColor || !iconKey));

  // helper - template

  const template = {
    fields: [
      {
        key: "type",
        type: "optionKeyFromIcons",
        valueOptions: annotationTypes,
      },
      {
        key: "iconKey",
        type: "icon",
        label: "Icône",
        spriteImage,
        options: { fillColor: newAnnotation?.fillColor },
        //hide: true,
        hide: newAnnotation?.type !== "MARKER",
      },

      {
        key: "tempLabel",
        type: "text",
        width: 150,
        placeholder: "Libellé",
        options: { readOnly: annotationTemplate },
      },
      { key: "fillColor", type: "color" },
    ],
  };

  // helpers

  const item = { ...newAnnotation, tempLabel };

  // handlers

  function handleItemChange(newItem) {
    const annot = { ...newItem };

    // get existing annotation template
    const annotationTemplate = getAnnotationTemplateFromAnnotation({
      annotation: newItem,
      listing,
      annotationTemplates,
    });

    if (annotationTemplate) {
      dispatch(setTempAnnotationTemplateLabel(annotationTemplate.label));
      annot.annotationTemplateId = annotationTemplate.id;
    } else {
      dispatch(setTempAnnotationTemplateLabel(newItem.tempLabel));
      annot.annotationTemplateId = null;
    }

    delete annot.tempLabel;

    dispatch(setNewAnnotation({ ...newAnnotation, ...annot }));
  }

  function handleClick() {
    dispatch(setEnabledDrawingMode(newAnnotation.type));
  }

  function handleClose() {
    if (onClose) onClose();
  }

  return (
    <Box sx={{ p: 1, display: "flex", alignItems: "center" }}>
      <FormVariantToolbar
        template={template}
        item={item}
        onItemChange={handleItemChange}
        gap={1}
      />
      <ButtonGeneric
        label={createS}
        onClick={handleClick}
        variant="contained"
        sx={{ ml: 2 }}
        disabled={disabled}
      />
      <IconButtonClose onClose={handleClose} sx={{ ml: 1 }} />
    </Box>
  );
}
