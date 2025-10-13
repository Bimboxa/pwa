import { useState, useEffect } from "react";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import FormAnnotationTemplate from "./FormAnnotationTemplate";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function SectionEditAnnotationTemplate({
  annotationTemplate,
  onSaveClick,
  onCloseClick,
}) {
  // strings

  const saveS = "Enregistrer";

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

  return (
    <BoxFlexVStretch>
      <BoxAlignToRight>
        <IconButtonClose onClose={onCloseClick} />
      </BoxAlignToRight>
      <FormAnnotationTemplate
        annotationTemplate={annotationTemplate}
        onChange={handleChange}
        onSaveClick={onSaveClick}
      />
      <ButtonInPanelV2 onClick={handleSave} label={saveS} variant="contained" />
    </BoxFlexVStretch>
  );
}
