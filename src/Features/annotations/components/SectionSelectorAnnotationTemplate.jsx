import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import { Box } from "@mui/material";

import SelectorAnnotationTemplateVariantList from "./SelectorAnnotationTemplateVariantList";

export default function SectionSelectorAnnotationTemplate() {
  // data

  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();

  // handlers

  function handleChange(annotationTemplate) {
    console.log("annotationTemplate", annotationTemplate);
  }

  // render

  return (
    <Box sx={{ width: 1 }}>
      <SelectorAnnotationTemplateVariantList
        annotationTemplates={annotationTemplates}
        onChange={handleChange}
        spriteImage={spriteImage}
      />
    </Box>
  );
}
