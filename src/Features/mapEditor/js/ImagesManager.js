import createImageNodeAsync from "./utilsImagesManager/createImageNodeAsync";
import getStagePositionAndScaleFromImageSize from "../utils/getStagePositionAndScaleFromImageSize";

export default class ImagesManager {
  constructor({ mapEditor, onMapEditorIsReady }) {
    this.mapEditor = mapEditor;
    this.onMapEditorIsReady = onMapEditorIsReady;

    this.stage = mapEditor.stage;
    this.layerImages = mapEditor.layerImages;

    this.mainImageNode = null;

    this.init();
  }

  init = () => {
    console.log("init ImagesManager");
    this.onMapEditorIsReady();
  };

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
        this.centerStageOnImageNode(imageNode);
      }
    } catch (error) {
      console.error(error);
    }
  };

  centerStageOnImageNode = (imageNode) => {
    const width = imageNode.width();
    const height = imageNode.height();
    const imageSize = { width, height };
    const { x, y, scale } = getStagePositionAndScaleFromImageSize(
      this.stage,
      imageSize
    );
    this.stage.position({ x, y });
    this.stage.scale({ x: scale, y: scale });
  };

  deleteAllImagesNodes = () => {
    this.layerImages.destroyChildren();
    this.mainImageNode = null;
  };
}
