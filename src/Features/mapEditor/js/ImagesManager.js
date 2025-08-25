import createImageNodeAsync from "./utilsImagesManager/createImageNodeAsync";
import getStagePositionAndScaleFromImageSize from "../utils/getStagePositionAndScaleFromImageSize";

import theme from "Styles/theme";

import Image2D from "./Image2D";

import html2canvas from "html2canvas";
import { DevicesRounded } from "@mui/icons-material";

export default class ImagesManager {
  constructor({ mapEditor, onMapEditorIsReady }) {
    this.mapEditor = mapEditor;
    this.onMapEditorIsReady = onMapEditorIsReady;

    this.stage = mapEditor.stage;
    this.layerImages = mapEditor.layerImages;

    this.bgImageNode = null;
    this.legendImage2D = null;

    this.mainImageNode = null;
    this.mainImage2D = null;

    this.imageNodesById = {};

    this.selectedImageNodeIds = [];

    this.init();
  }

  init = () => {
    console.log("init ImagesManager");
    this.onMapEditorIsReady();
  };

  setBgImageNodeAsync = async (image) => {
    if (this.bgImageNode) this.bgImageNode.destroy();
    // main
    const imageNode = await createImageNodeAsync({ ...image, x: 0, y: 0 });
    this.layerImages.add(imageNode);
    imageNode.moveToBottom();
    this.bgImageNode = imageNode;

    console.log("[ImageManager] adde bgImageNode", this.bgImageNode);
    if (!this.mapEditor.printModeEnabled) {
      this.bgImageNode.hide();
    }
  };

  createImage2DAsync = async (image, options) => {
    // options
    const center = options?.center;
    const isMainImage = options?.isMainImage;
    const baseMapId = options?.fromBaseMapId;

    // main
    const image2D = await Image2D.create({
      ...image,
      nodeType: isMainImage ? "MAIN_IMAGE" : "IMAGE",
      baseMapId,
    });

    console.log("createImage2DAsync", image2D);
    this.layerImages.add(image2D.group);
    this.mainImage2D = image2D;

    // center
    if (center) this.centerImage2D(image2D);
  };

  // DEPRECATED
  createImageNodeAsync = async (image, options) => {
    console.log("[ImagesManager] createImageNodeAsync", image);
    try {
      // options
      const isMainImage = options?.isMainImage ?? false;

      // main

      //const image2D = await Image2D.create(image);

      const imageNode = await createImageNodeAsync(image);
      //const imageNode = image2D.group;
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
        this.centerImageNode(imageNode);
        //this.centerStageOnImageNode(imageNode);
      }

      // update manager
      this.imageNodesById[imageNode.id] = imageNode;
    } catch (error) {
      console.error(error);
    }
  };

  centerImageNode = (imageNode) => {
    if (!imageNode || !this.stage) return;

    const stage = this.stage;
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    const imageWidth = imageNode.width();
    const imageHeight = imageNode.height();

    // Calculate scale to fit image in stage (objectFit: "contain")
    const scale = Math.min(stageWidth / imageWidth, stageHeight / imageHeight);

    // Center the image in the stage
    const x = (stageWidth - imageWidth * scale) / 2;
    const y = (stageHeight - imageHeight * scale) / 2;

    // Set imageNode scale and position
    imageNode.scale({ x: scale, y: scale });
    imageNode.position({ x, y });
  };

  centerImage2D = (image2D) => {
    if (!image2D || !this.stage) return;

    console.log("[centerImage2D] image2D", image2D);
    const stage = this.stage;
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    const imageWidth = image2D.width;
    const imageHeight = image2D.height;

    // Calculate scale to fit image in stage (objectFit: "contain")
    const scale = Math.min(
      (stageWidth - 2 * this.mapEditor.offset.x) / imageWidth,
      (stageHeight - 2 * this.mapEditor.offset.x) / imageHeight
    );

    // Center the image in the stage
    const x = (stageWidth - imageWidth * scale) / 2;
    const y = (stageHeight - imageHeight * scale) / 2;

    // Set imageNode scale and position
    image2D.setScale(scale);
    image2D.setPosition({ x, y });
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

  deleteMainImageNode = () => {
    if (!this.mainImageNode) return;
    this.mainImageNode.destroy();
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

  // DELETE

  deleteMainImage2D = () => {
    if (!this.mainImage2D) return;
    this.mainImage2D.destroyNodes();
    this.mainImage2D = null;
  };
}
