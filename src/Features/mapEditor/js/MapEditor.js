import Konva from "konva";

import ImagesManager from "./ImagesManager";
import ShapesManager from "./ShapesManager";

import getStagePositionAndScaleFromImageSize from "../utils/getStagePositionAndScaleFromImageSize";

export default class MapEditor {
  constructor({container, width, height, onMapEditorIsReady}) {
    this.stage = new Konva.Stage({container, draggable: true, width, height});

    this.scaleBy = 1.1;

    this.layerImages = new Konva.Layer();
    this.layerShapes = new Konva.Layer();

    this.stage.add(this.layerImages);
    this.stage.add(this.layerShapes);

    this.imagesManager = new ImagesManager({
      mapEditor: this,
    });

    this.shapesManager = new ShapesManager({
      mapEditor: this,
      onMapEditorIsReady,
    });

    this.stage.on("wheel", (e) => this.handleWheelEvent(e));
  }

  /*
   * listeners
   */

  handleWheelEvent = (e) => {
    e.evt.preventDefault();
    var oldScale = this.stage.scaleX();

    var pointer = this.stage.getPointerPosition();

    var mousePointTo = {
      x: (pointer.x - this.stage.x()) / oldScale,
      y: (pointer.y - this.stage.y()) / oldScale,
    };

    var newScale =
      e.evt.deltaY < 0 ? oldScale * this.scaleBy : oldScale / this.scaleBy;

    this.stage.scale({x: newScale, y: newScale});

    var newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    this.stage.position(newPos);
    this.stage.batchDraw();
  };

  resizeStage() {
    const bbox = this.stage.container().getBoundingClientRect();
    this.stage.width(bbox.width);
    this.stage.height(bbox.height);
  }

  // control

  refresh() {
    const width = this.imagesManager.mainImageNode.width();
    const height = this.imagesManager.mainImageNode.height();
    const imageSize = {width, height};
    const {x, y, scale} = getStagePositionAndScaleFromImageSize(
      this.stage,
      imageSize
    );
    console.log("[MapEditor] refresh", {x, y, scale});
    this.stage.position({x, y});
    this.stage.scale({x: scale, y: scale});
  }

  // main image

  loadMainImage(image) {
    this.imagesManager.createImageNodeAsync(image, {isMainImage: true});
  }
  // shapes

  loadShapes(shapes) {
    this.shapesManager.createShapesNodes(shapes);
  }
}
