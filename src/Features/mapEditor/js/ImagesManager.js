import createImageNodeAsync from "./utilsImagesManager.js/createImageNodeAsync";

export default class ImagesManager {
  constructor({mapEditor}) {
    this.mapEditor = mapEditor;

    this.layerImages = mapEditor.layerImages;

    this.mainImageNode = null;
  }

  createImageNodeAsync = async (image, options) => {
    console.log("[ImagesManager] createImageNodeAsync", image);
    try {
      // options
      const isMainImage = options?.isMainImage ?? false;

      // main
      const imageNode = await createImageNodeAsync(image);
      console.log("imageNode", imageNode);
      this.layerImages.add(imageNode);

      // post process
      if (isMainImage) {
        this.mainImageNode = imageNode;
      }
    } catch (error) {
      console.error(error);
    }
  };
}
