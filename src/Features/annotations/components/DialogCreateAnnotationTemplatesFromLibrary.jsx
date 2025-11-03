import { useState } from "react";

import useCreateAnnotationTemplatesFromLibrary from "../hooks/useCreateAnnotationTemplatesFromLibrary";
import useAnnotationTemplatesFromLibrary from "../hooks/useAnnotationTemplatesFromLibrary";

import { DialogTitle } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSelectAnnotationTemplates from "./SectionSelectAnnotationTemplates";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function DialogCreateAnnotationTemplatesFromLibrary({
  open,
  onClose,
}) {
  // strings

  const titleS = "Sélectionnez les modèles à ajouter";
  const createS = "Ajouter la sélection";

  // state

  const [selection, setSelection] = useState([]);

  // data

  const annotationTemplates = useAnnotationTemplatesFromLibrary({
    addId: true,
  });

  const createAnnotationTemplatesFromLibrary =
    useCreateAnnotationTemplatesFromLibrary();

  // helpers

  const label = createS + " (" + selection.length + ")";

  // handlers

  function handleSelectionChange(selection) {
    console.log("selection", selection);
    setSelection(selection);
  }

  async function handleCreate() {
    const templates = annotationTemplates.filter((template) =>
      selection.includes(template.id)
    );
    await createAnnotationTemplatesFromLibrary(templates);
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width="240" vh="75">
      <DialogTitle>{titleS}</DialogTitle>
      <BoxFlexVStretch sx={{ flex: 1 }}>
        <SectionSelectAnnotationTemplates
          annotationTemplates={annotationTemplates}
          selection={selection}
          onChange={handleSelectionChange}
        />
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={label}
        onClick={handleCreate}
        variant="contained"
        color="secondary"
        disabled={selection.length === 0}
      />
    </DialogGeneric>
  );
}
