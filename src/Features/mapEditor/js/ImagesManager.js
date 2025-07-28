import createImageNodeAsync from "./utilsImagesManager/createImageNodeAsync";
import getStagePositionAndScaleFromImageSize from "../utils/getStagePositionAndScaleFromImageSize";

import theme from "Styles/theme";

export default class ImagesManager {
  constructor({ mapEditor, onMapEditorIsReady }) {
    this.mapEditor = mapEditor;
    this.onMapEditorIsReady = onMapEditorIsReady;

    this.stage = mapEditor.stage;
    this.layerImages = mapEditor.layerImages;

    this.mainImageNode = null;

    this.imageNodesById = {};

    this.selectedImageNodeIds = [];

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

      // events
      imageNode.on("click", () => {
        if (!this.selectedImageNodeIds.includes(imageNode.id)) {
          this.selectImageNode(imageNode.id);
        } else {
          this.unselectImageNode(imageNode.id);
        }
        console.log("imageNode clicked:", imageNode);
      });

      // post process
      if (isMainImage) {
        this.mainImageNode = imageNode;
        this.centerStageOnImageNode(imageNode);
      }

      // update manager
      this.imageNodesById[imageNode.id] = imageNode;
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

  /*
   * SELECTOR
   */

  selectImageNode(id) {
    const imageNode = this.imageNodesById[id];

    if (imageNode) {
      // Remove existing border if any
      if (imageNode._borderRect) {
        imageNode._borderRect.destroy();
        imageNode._borderRect = null;
      }

      // Add a 2px border rectangle around the image node
      const borderRect = new Konva.Rect({
        x: imageNode.x(),
        y: imageNode.y(),
        width: imageNode.width(),
        height: imageNode.height(),
        stroke: theme.palette.editor.selected,
        strokeWidth: 2,
        listening: false,
        perfectDrawEnabled: false,
      });

      // Add the border to the same layer as the image node, just above it
      imageNode.getLayer().add(borderRect);
      borderRect.moveToTop();
      imageNode.moveToTop();

      // Store reference for later removal
      imageNode._borderRect = borderRect;

      // update selection memory
      if (!this.selectedImageNodeIds) {
        this.selectedImageNodeIds = [];
      }
      if (!this.selectedImageNodeIds.includes(id)) {
        this.selectedImageNodeIds.push(id);
      }
    }
  }

  unselectImageNode(id) {
    const imageNode = this.imageNodesById[id];

    if (imageNode && imageNode._borderRect) {
      imageNode._borderRect.destroy();
      imageNode._borderRect = null;
    }

    // Remove the id from the this.selectedImageNodeIds array if it exists
    if (this.selectedImageNodeIds && Array.isArray(this.selectedImageNodeIds)) {
      this.selectedImageNodeIds = this.selectedImageNodeIds.filter(
        (selectedId) => selectedId !== id
      );
    }
  }
}
