import { useState } from "react";

import useCreateAnnotationTemplate from "../hooks/useCreateAnnotationTemplate";
import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";

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
  const logAppEvent = useLogAppEvent();

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
    await createAnnotationTemplate(tempAnnotationTemplate, { listingId });
    logAppEvent("ANNOTATION_TEMPLATE_CREATED", {
      name: tempAnnotationTemplate?.label,
    });
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
