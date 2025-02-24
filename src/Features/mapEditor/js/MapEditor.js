import Konva from "konva";

import ShapesManager from "./ShapesManager";

export default class MapEditor {
  constructor({container, width, height, onMapEditorIsReady}) {
    this.stage = new Konva.Stage({container, draggable: true, width, height});

    this.scaleBy = 1.1;

    this.layerShapes = new Konva.Layer();

    this.stage.add(this.layerShapes);

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

  // shapes

  loadShapes(shapes) {
    this.shapesManager.createShapesNodes(shapes);
  }
}
