import getImageSizeAsync from "Features/misc/utils/getImageSize";
import createImageNodeAsync from "./utilsImagesManager/createImageNodeAsync";

import Konva from "konva";
import ImageObject from "Features/images/js/ImageObject";

export default class Image2D {
  imageNode;
  borderNode;
  group;
  transformer;

  isSelected = false;
  isTransforming = false;

  constructor({ url, x, y, width, height, rotateEnabled, resizeEnabled }) {
    this.url = url;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.transformer = new Konva.Transformer({
      rotateEnabled,
      resizeEnabled,
      borderStroke: "#39FF14", // Flash green
      borderStrokeWidth: 2,
      anchorStroke: "#39FF14",
      anchorFill: "#39FF14",
      anchorSize: 8,
    });
  }

  /*
   * STATIC - create
   */

  static create = async (image) => {
    const image2D = new Image2D(image);

    const imageNode = await createImageNodeAsync(image);

    // Create a group to contain both image and border
    const group = new Konva.Group({
      x: imageNode.x(),
      y: imageNode.y(),
      draggable: false, // Start with dragging disabled
    });

    // Create border rectangle
    const borderNode = new Konva.Rect({
      x: 0,
      y: 0,
      width: imageNode.width(),
      height: imageNode.height(),
      stroke: "#39FF14", // Flash green
      strokeWidth: 2,
      opacity: 0,
    });

    // Add image and border to group
    group.add(borderNode);
    group.add(imageNode);

    // Update image position relative to group
    imageNode.x(0);
    imageNode.y(0);

    // update object
    image2D.imageNode = imageNode;
    image2D.borderNode = borderNode;
    image2D.group = group;

    image2D.addListeners();

    return image2D;
  };

  /*
   * UPDATE
   */

  /*
   * LISTENERS
   */

  addListeners = () => {
    this.group.on("click", this.handleClick);
    this.group.on("dblclick", this.handleDblclick);
  };

  removeListeners = () => {
    this.group.off("click", this.handleClick);
    this.group.off("dblclick", this.handleDblclick);
  };

  handleClick = () => {
    console.log("click", this);
    this.toggleSelection();
  };

  handleDblclick = () => {
    this.toggleTransformer();
  };

  /*
   * SIZE & SCALE
   */

  setWidth = (width) => {
    this.width = width;
    this.group.width(width);
  };

  setHeight = (height) => {
    this.height = height;
    this.group.height(height);
  };

  setScale = (scale) => {
    this.group.scale({ x: scale, y: scale });
  };

  setPosition = ({ x, y }) => {
    this.group.position({ x, y });
  };

  /*
   * SELECT
   */

  toggleSelection = () => {
    if (this.isSelected) {
      this.unselect();
    } else {
      this.select();
    }
  };

  select = () => {
    this.borderNode.opacity(1);
    this.isSelected = true;
  };

  unselect = () => {
    this.borderNode.opacity(0);
    this.isSelected = false;
    this.disableTransformer();
  };

  /*
   * SHOW / HIDE
   */

  hide = () => {
    this.group.hide();
  };

  show = () => {
    this.group.show();
  };

  /*
   * TRANSFORMER
   */

  toggleTransformer = () => {
    if (this.isTransforming) {
      this.disableTransformer();
    } else {
      this.enableTransformer();
    }
  };

  enableTransformer = () => {
    if (!this.isSelected) {
      this.select();
    }

    this.transformer.nodes([this.group]);
    this.group.getLayer().add(this.transformer);
    this.group.draggable(true); // Enable dragging when transformer is active
    this.isTransforming = true;
  };

  disableTransformer = () => {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.group.draggable(false); // Disable dragging when transformer is inactive
    this.isTransforming = false;
  };

  // DELETE

  destroyNodes = () => {
    this.group.destroy();
    this.borderNode.destroy();
    this.imageNode.destroy();
    this.transformer.destroy();
  };
}
