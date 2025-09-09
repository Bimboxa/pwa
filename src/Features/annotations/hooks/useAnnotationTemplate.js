import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useAnnotationTemplate(annotation) {
  const appConfig = useAppConfig();

  // helpers - spriteImage

  const spriteImages = appConfig?.features?.markers?.spriteImages;
  const spriteImage = spriteImages?.[0];

  // main

  const template = {
    fields: [
      {
        key: "color",
        label: "Couleur",
        type: "color",
      },
      {
        key: "icon",
        label: "Icône",
        type: "icon",
        options: {
          spriteImage,
          iconColor: annotation?.color,
        },
      },
    ],
  };

  // render

  return template;
}
