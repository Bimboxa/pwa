import useAnnotationSpriteImage from "./useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";
import useAnnotationTemplates from "./useAnnotationTemplates";

export default function useAnnotationTemplate(annotation, options) {
  // options

  const annotationType = options?.annotationType;

  // data

  const spriteImage = useAnnotationSpriteImage();
  //const annotationTemplates = useLegendItems();
  const annotationTemplates = useAnnotationTemplates();

  // helpers

  const field_annotationTemplate = {
    key: "annotationTemplateId",
    label: "Bibliothèque",
    type: "annotationTemplateId",
    options: {
      spriteImage,
      annotationTemplates,
    },
  };

  const field_fillColor = {
    key: "fillColor",
    label: "Couleur",
    type: "color",
  };

  const field_iconKey = {
    key: "iconKey",
    label: "Icône",
    type: "icon",
    options: {
      spriteImage,
      iconColor: annotation?.fillColor,
    },
  };

  const field_fontSize = {
    key: "fontSize",
    label: "Taille",
    type: "text",
  };

  // main

  let fields;
  switch (annotationType) {
    case "MARKER": {
      fields = [field_annotationTemplate, field_fillColor, field_iconKey];
      break;
    }
    case "TEXT": {
      fields = [field_fontSize];
      break;
    }
  }

  const template = {
    fields,
  };

  // render

  return template;
}
