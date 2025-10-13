export default function useBlueprintFormTemplate() {
  // data
  const bgImages = useBgImagesFromAppConfig();
  return {
    fields: [
      {
        key: "name",
        label: "Nom",
        type: "text",
      },
      {
        key: "bgImageKey",
        label: "Image",
        type: "imageKeyFromOptions",
        options: {
          images: bgImages,
          columns: 2,
        },
      },
      {
        key: "bgImageRawTextAnnotations",
        label: "Cartouche",
        type: "metadata",
      },
    ],
  };
}
