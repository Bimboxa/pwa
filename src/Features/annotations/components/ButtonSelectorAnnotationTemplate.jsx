import { useState } from "react";

import { ArrowDropDown as Down } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SelectorAnnotationTemplateVariantList from "./SelectorAnnotationTemplateVariantList";

export default function ButtonSelectorAnnotationTemplate({
  annotationTemplateId,
  onChange,
  annotationTemplates,
  spriteImage,
}) {
  // state

  const [open, setOpen] = useState(false);

  // helper

  const annotationTemplate = annotationTemplates?.find(
    (t) => t.id === annotationTemplateId
  );

  const label = annotationTemplate?.label ?? "Chosir une annotation";

  // handlers

  function handleChange(id) {
    onChange(id);
    setOpen(false);
  }
  return (
    <>
      <ButtonGeneric
        label={label}
        onClick={() => setOpen(true)}
        endIcon={<Down />}
      />
      <DialogGeneric open={open} onClose={() => setOpen(false)}>
        <SelectorAnnotationTemplateVariantList
          selectedAnnotationTemplateId={annotationTemplateId}
          onChange={handleChange}
          annotationTemplates={annotationTemplates}
          spriteImage={spriteImage}
        />
      </DialogGeneric>
    </>
  );
}
