import { useState } from "react";

import useCreateAnnotationTemplate from "../hooks/useCreateAnnotationTemplate";

import FormAnnotationTemplate from "./FormAnnotationTemplate";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function DialogCreateAnnotationTemplate({ open, onClose }) {
  // strings

  const createS = "Créer";

  // data

  const createAnnotationTemplate = useCreateAnnotationTemplate();

  // state

  const [tempAnnotationTemplate, setTempAnnotationTemplate] = useState(null);

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
    await createAnnotationTemplate(tempAnnotationTemplate);
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">
      <FormAnnotationTemplate
        annotationTemplate={tempAnnotationTemplate}
        onChange={handleChange}
      />
      <ButtonInPanelV2
        onClick={handleCreate}
        label={createS}
        variant="contained"
      />
    </DialogGeneric>
  );
}
