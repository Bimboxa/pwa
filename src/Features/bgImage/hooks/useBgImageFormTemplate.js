import useBgImagesFromAppConfig from "./useBgImagesFromAppConfig";

export default function useBgImageFormTemplate() {
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
    ],
  };

  // return

  return template;
}
