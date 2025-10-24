import { useState, useEffect } from "react";

import { Box } from "@mui/material";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import FormAnnotationTemplateVariantBlock from "./FormAnnotationTemplateVariantBlock";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function SectionEditAnnotationTemplate({
  annotationTemplate,
  onSaveClick,
  onDeleteClick,
  onCloseClick,
}) {
  // strings

  const title = "Editer l'annotation type";
  const saveS = "Enregistrer";
  const deleteS = "Supprimer";

  // state

  const [tempAnnotationTemplate, setTempAnnotationTemplate] = useState(null);
  useEffect(() => {
    setTempAnnotationTemplate(annotationTemplate);
  }, [annotationTemplate]);

  // handlers

  function handleChange(annotationTemplate) {
    setTempAnnotationTemplate(annotationTemplate);
  }

  function handleSave() {
    onSaveClick(tempAnnotationTemplate);
  }

  function handleDelete() {
    onDeleteClick(annotationTemplate);
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose onClose={onCloseClick} title={title} />

      <BoxFlexVStretch>
        <Box
          sx={{
            width: 1,
            overflow: "auto",
            bgcolor: "white",
            p: 1,
          }}
        >
          <FormAnnotationTemplateVariantBlock
            annotationTemplate={annotationTemplate}
            onChange={handleChange}
            onSaveClick={onSaveClick}
          />
          <BoxAlignToRight sx={{ mt: 1 }}>
            <ButtonGeneric label={saveS} onClick={handleSave} size="small" />
          </BoxAlignToRight>
        </Box>
      </BoxFlexVStretch>

      <ButtonInPanelV2
        onClick={handleDelete}
        label={deleteS}
        variant="outlined"
      />
    </BoxFlexVStretch>
  );
}
