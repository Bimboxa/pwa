import store from "App/store";

import {setSelectedShapeId} from "Features/shapes/shapesSlice";

import createShapeNode from "./utilsShapesManager.js/createShapeNode";

import theme from "Styles/theme";

export default class ShapesManager {
  constructor({mapEditor, onMapEditorIsReady}) {
    this.mapEditor = mapEditor;
    this.onMapEditorIsReady = onMapEditorIsReady;

    this.stage = null;

    this.lastCursor = null;

    this.shapesNodesMap = {};

    this.selectedShapeId = null;

    //this.unsubscribe = store.subscribe(this.handleStoreChange);

    this.init();
  }
  // initialization

  init() {
    this.onMapEditorIsReady();
    this.stage = this.mapEditor.stage;
  }

  // listeners - events

  handleShapeClick = (shape) => {
    const id = this.selectedShapeId === shape.id ? null : shape.id;
    store.dispatch(setSelectedShapeId(id));
    store.dispatch(setSelectedShapeId(shape.id));
  };

  handleShapeMouseEnter = (shape) => {
    this.lastCursor = this.mapEditor.stage.container().style.cursor;
    this.mapEditor.stage.container().style.cursor = "pointer";
  };

  handleShapeMouseLeave = (shape) => {
    this.mapEditor.stage.container().style.cursor = this.lastCursor;
  };

  // listeners - state

  handleStoreChange = () => {
    console.log("handleStoreChange");
    // create
    const shapesUpdatedAt = store.getState().shapes.shapesUpdatedAt;
    if (this.shapesUpdatedAt !== shapesUpdatedAt) {
      this.shapesUpdatedAt = shapesUpdatedAt;
      const shapesMap = store.getState().shapes.shapesMap;
      const shapes = Object.values(shapesMap);
      this.redrawShapesNodes(shapes);
    }

    // select
    const selectedShapeId = store.getState().shapes.selectedShapeId;
    if (this.selectedShapeId !== selectedShapeId) {
      this.unselectShape();
      this.selectShape(selectedShapeId);
    }
  };

  // shapes

  redrawShapesNodes(shapes) {
    this.deleteAllShapesNodes();
    this.createShapesNodes(shapes);
  }

  createShapesNodes(shapes) {
    shapes.forEach((shape) => {
      const node = createShapeNode({
        shape,
        stageScale: this.stage.scaleX(),
        onClick: this.handleShapeClick,
      });

      node.on("mouseenter", () => this.handleShapeMouseEnter(shape));
      node.on("mouseleave", () => this.handleShapeMouseLeave(shape));

      this.mapEditor.layerShapes.add(node);
      this.shapesNodesMap[shape.id] = node;
    });
    this.mapEditor.layerShapes.batchDraw();
  }

  deleteAllShapesNodes() {
    this.mapEditor.layerShapes.destroyChildren();
    this.shapesNodesMap = {};
    this.mapEditor.layerShapes.batchDraw();
  }

  // selection

  selectShape(shapeId) {
    this.selectedShapeId = shapeId;
    const shapeNode = this.shapesNodesMap[shapeId];
    if (!shapeNode) return;
    shapeNode.fill(theme.palette.shape.selected);
    this.mapEditor.layerShapes.batchDraw();
  }

  unselectShape() {
    const shapeId = this.selectedShapeId;
    const shapeNode = this.shapesNodesMap[shapeId];
    if (!shapeNode) return;
    shapeNode.fill(theme.palette.shape.default);
    this.mapEditor.layerShapes.batchDraw();
    //
    this.selectedShapeId = null;
  }

  // cleanup

  cleanup() {
    if (this.unsubscribe) this.unsubscribe();
  }
}
