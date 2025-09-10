import useAnnotationSpriteImage from "./useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";

export default function useAnnotationTemplate(annotation) {
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useLegendItems();

  // main

  const template = {
    fields: [
      {
        key: "annotationTemplateId",
        label: "Bibliothèque",
        type: "annotationTemplateId",
        options: {
          spriteImage,
          annotationTemplates,
        },
      },
      {
        key: "label",
        label: "Libellé",
        type: "text",
        options: {
          fullWidth: true,
          showAsSection: true,
          hideBorder: true,
          placeholder: "titre à définir",
        },
      },
      {
        key: "fillColor",
        label: "Couleur",
        type: "color",
      },
      {
        key: "iconKey",
        label: "Icône",
        type: "icon",
        options: {
          spriteImage,
          iconColor: annotation?.fillColor,
        },
      },
    ],
  };

  // render

  return template;
}
