import useAnnotationSpriteImage from "./useAnnotationSpriteImage";

export default function useAnnotationTemplate(annotation) {
  const spriteImage = useAnnotationSpriteImage();

  // main

  const template = {
    fields: [
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
