import useBgImagesFromAppConfig from "./useBgImagesFromAppConfig";

export default function useBgImageFormTemplate(bgImageItem) {
  // data

  const bgImages = useBgImagesFromAppConfig();

  console.log("debug_1609 bgImages", bgImages);

  // main

  const template = {
    fields: [
      {
        key: "show",
        label: "Afficher",
        type: "check",
      },
      {
        key: "imageKey",
        label: "Image",
        type: "imageKeyFromOptions",
        options: {
          images: bgImages,
          columns: 2,
        },
      },
      {
        key: "metadata",
        label: "Texte du gabarit",
        type: "metadata",
      },
    ],
  };

  // return

  return template;
}
