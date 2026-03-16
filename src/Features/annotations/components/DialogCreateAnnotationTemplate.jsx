import { useState } from "react";

import useCreateAnnotationTemplate from "../hooks/useCreateAnnotationTemplate";

import FormAnnotationTemplateVariantBlock from "./FormAnnotationTemplateVariantBlock";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import { DialogTitle, Box } from "@mui/material";
import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

export default function DialogCreateAnnotationTemplate({ open, onClose, listingId }) {
  // strings

  const createS = "Créer";
  const title = "Nouveau modèle";

  // data

  const createAnnotationTemplate = useCreateAnnotationTemplate();

  // state

  const initialAnnotationTemplate = {
    drawingShape: "MARKER",
    label: "",
    isFromAnnotation: true,
    ...getDefaultsForShape("MARKER"),
  };

  const [tempAnnotationTemplate, setTempAnnotationTemplate] = useState(
    initialAnnotationTemplate
  );

  // handlers

  function handleChange(annotationTemplate) {
    setTempAnnotationTemplate(annotationTemplate);
  }

  function handleClose() {
    setTempAnnotationTemplate(null);
    onClose();
  }

  async function handleCreate() {
    console.log("handleSave", tempAnnotationTemplate);
    await createAnnotationTemplate(tempAnnotationTemplate, { listingId });
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">
      <DialogTitle>{title}</DialogTitle>
      <Box sx={{ bgcolor: "background.default", width: 1 }}>
        <FormAnnotationTemplateVariantBlock
          annotationTemplate={tempAnnotationTemplate}
          onChange={handleChange}
        />
      </Box>

      <ButtonInPanelV2
        onClick={handleCreate}
        label={createS}
        variant="contained"
      />
    </DialogGeneric>
  );
}
