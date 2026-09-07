import useBgImagesFromAppConfig from "./useBgImagesFromAppConfig";

export default function useBgImageFormTemplate() {
  // data

  const bgImages = useBgImagesFromAppConfig();

  // main

  const template = {
    fields: [
      {
        key: "imageKey",
        label: "Arrière plan",
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
