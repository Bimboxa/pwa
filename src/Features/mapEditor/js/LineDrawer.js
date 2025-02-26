import Konva from "konva";

import getMousePositionInStage from "../utils/getMousePositionInStage";
import getSnapPoint from "../utils/getSnapPoint";
import getDistance from "../utils/getDistance";
import getMapEditorBboxInStage from "./utilsMapEditor/getMapEditorBboxInStage";

import parsePointsFromNodeToState from "./utilsShapesManager/parsePointsFromNodeToState";

import store from "App/store";

import {createShape} from "Features/shapes/shapesSlice";
import {nanoid} from "@reduxjs/toolkit";
import {setAnchorPositionScale, setScaleInPx} from "../mapEditorSlice";
import getSegmentNodeDistance from "./utilsShapesManager/getSegmentNodeDistance";
import computeShapeSurface from "Features/shapes/utils/computeShapeSurface";
import computeShapeLength from "Features/shapes/utils/computeShapeLength";
import addShapeRowService from "Features/gapi/gapiServicesGSheetMisc/addShapeRowService";

export default class LineDrawer {
  constructor({mapEditor}) {
    this.mapEditor = mapEditor;
    this.shapeProps = null;

    this.layerEditedShape = mapEditor.layerEditedShape;
    this.stage = mapEditor.stage;
    this.stageScale = mapEditor.stage.scaleX();

    this.variant = null; // "SEGMENT" | "POLYLINE" | "POLYGON"

    this.node = null;
    this.lastPoint = null; // {x,y}
    this.nodePointsPrev = [];
    //this.clickedCoords = []; // [{x,y}] in window. To get anchorElement for PopperEditScale

    this.endNode = null;
    this.endNodeRadiusCore = 10;
    this.thresholdEndNode = 0.05;
    this.endNodeIsActive = false;

    this.newShape = null;

    this.unsubsribe = store.subscribe(() => {
      const newShape = store.getState().shapes.newShape;
      this.newShape = newShape;
    });
  }

  // reset

  _resetDrawer() {
    this.node = null;
    this.lastPoint = null;
    this.nodePointsPrev = [];
    //
    this.endNode = null;
    this.endNodeIsActive = false;
    //
    this.layerEditedShape.destroyChildren();
  }
  // controls

  startDrawing(variant, shapeProps) {
    this.shapeProps = shapeProps;
    if (this.variant) this.stopDrawing();
    this.variant = variant;
    //
    this.stage.on("click", this.handlerPointerClick);
    this.stage.on("mousemove", this.handlerPointerMove);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  stopDrawing() {
    this.stage.off("click", this.handlerPointerClick);
    this.stage.off("mousemove", this.handlerPointerMove);
    window.removeEventListener("keydown", this.handleKeyDown);
    //
    this._resetDrawer();
    this.variant = null;
  }

  abordDrawing() {
    this._resetDrawer();
  }

  // handlers

  _testEnd() {
    try {
      if (!this.node) return false;
      if (this.variant === "SEGMENT") {
        return this.node.points().length === 4;
      } else {
        return this.endNode && this.endNode.isVisible() && this.endNodeIsActive;
      }
    } catch (error) {
      console.log(error);
    }
  }

  handlerPointerClick = (e) => {
    const end = this._testEnd();
    //
    const {x, y} = getMousePositionInStage(this.stage);
    //
    if (!this.node) {
      this._initNode(x, y);
    } else if (end) {
      this._stopAddingPoints(x, y);
      //
      if (this.shapeProps?.isScale) {
        const scaleInPx = getSegmentNodeDistance(this.node);
        const anchorPosition = {x: e.evt.clientX, y: e.evt.clientY};
        store.dispatch(setAnchorPositionScale(anchorPosition));
        store.dispatch(setScaleInPx(scaleInPx));
      }
      //
      const shape = this._getShape();
      store.dispatch(createShape(shape));

      // gapi
      try {
        const gSheetId = store.getState().gapi.gSheetId;
        addShapeRowService(shape, gSheetId);
      } catch (e) {
        console(e);
      }

      //
      this._resetDrawer();
      // stop drawing
    } else {
      this._saveTempPoint();
    }
  };

  handlerPointerMove = (e) => {
    if (this.lastPoint) {
      const mousePosition = getMousePositionInStage(this.stage);
      let nextPoint;
      if (e.evt.shiftKey) {
        nextPoint = getSnapPoint(mousePosition, this.lastPoint);
      } else {
        nextPoint = mousePosition;
        this.updateEndNode(nextPoint.x, nextPoint.y);
      }
      this._addTempPoint(nextPoint.x, nextPoint.y);
    }
  };

  handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (this.node) this.abordDrawing();
    }
  };

  //  ------------ endNode ------------

  initEndNode() {
    const {x, y} = this.getEndNodePosition();
    const stageScale = this.mapEditor.stage.scaleX();
    this.endNode = new Konva.Circle({
      x,
      y,
      radius: this.endNodeRadiusCore / stageScale,
      stroke: "black",
      strokeWidth: 1 / stageScale,
    });
    this.layerEditedShape.add(this.endNode);
    this.endNode.on("mouseenter", () => (this.endNodeIsActive = true));
    this.endNode.on("mouseleave", () => (this.endNodeIsActive = false));
  }

  getEndNodePosition() {
    if (this.node) {
      if (this.variant === "POLYLINE") {
        return this.lastPoint;
      } else if (this.variant === "POLYGON") {
        return {x: this.node.points()[0], y: this.node.points()[1]};
      }
    }
  }

  testShowEndNode(x, y) {
    const endNodePosition = this.getEndNodePosition();
    if (!endNodePosition) return null;
    //
    const distance = getDistance(endNodePosition, {x, y});
    const mapEditorBboxInStage = getMapEditorBboxInStage(this.mapEditor);
    const distanceRef = Math.min(
      mapEditorBboxInStage.width,
      mapEditorBboxInStage.height
    );
    const show = distance / distanceRef < this.thresholdEndNode;
    if (show) {
      return endNodePosition;
    } else {
      return null;
    }
  }

  updateEndNode(x, y) {
    //
    //if (!this.endNode) return; // comment: we need to create it !
    //
    const stageScale = this.mapEditor.stage.scaleX();
    const endNodePosition = this.testShowEndNode(x, y);
    if (endNodePosition) {
      if (!this.endNode) {
        this.initEndNode(x, y);
      } else {
        this.endNode.position(endNodePosition);
        this.endNode.radius(this.endNodeRadiusCore / stageScale);
      }
      this.endNode.show();
    } else {
      this.endNode.hide();
    }

    // color
    if (this.endNodeIsActive) {
      this.endNode.stroke("red");
    } else {
      this.endNode.stroke("black");
    }
  }

  //  ------------  helpers ------------

  _removeNode() {
    if (this.node) {
      this.layerEditedShape.destroyChildren();
      this.node = null;
    }
  }

  _initNode(x, y) {
    console.log("[LineDrawer] _initNode", x, y);
    this.node = new Konva.Line({
      points: [x, y],
      stroke: this.newShape.color ?? "black",
      strokeWidth: 2 / this.stageScale,
    });
    this.lastPoint = {x, y};
    this.nodePointsPrev = [x, y];
    this.layerEditedShape.add(this.node);
  }

  _addPoint(x, y) {
    const newPoints = [...this.nodePointsPrev, x, y];
    this.node.points(newPoints);
    this.lastPoint = {x, y};
    this.nodePointsPrev = newPoints;
    this.layerEditedShape.batchDraw();
  }

  _addTempPoint(x, y) {
    const newPoints = [...this.nodePointsPrev, x, y];
    this.node.points(newPoints);
    this.layerEditedShape.batchDraw();
  }

  _saveTempPoint() {
    this.nodePointsPrev = this.node.points();
    this.lastPoint = {
      x: this.nodePointsPrev[this.nodePointsPrev.length - 2],
      y: this.nodePointsPrev[this.nodePointsPrev.length - 1],
    };
  }
  _stopAddingPoints(x, y) {
    const newPoints = [...this.nodePointsPrev];
    if (this.variant === "SEGMENT") {
      newPoints.push(x, y);
    }
    this.node.points(newPoints);
    if (this.variant === "POLYGON") this.node.closed(true);
    this.layerEditedShape.batchDraw();
  }

  _getShape() {
    //
    const nodePoints = this.node.points();
    const imageSize = this.mapEditor.imagesManager.mainImageNode.size();
    const imagePosition = this.mapEditor.imagesManager.mainImageNode.position();
    const points = parsePointsFromNodeToState(
      nodePoints,
      imageSize,
      imagePosition
    );
    const shape = {...this.shapeProps, ...this.newShape, points};
    if (!shape.id) shape.id = nanoid();

    // map to compute qties
    const mapsMap = store.getState().maps.mapsMap;
    const mapId = store.getState().mapEditor.loadedMainMapId;
    const map = mapsMap[mapId];

    // compute qties
    const length = computeShapeLength(shape, map);
    const surface = computeShapeSurface(shape, map);
    const volume = surface * shape * 0.1;

    shape.length = length;
    shape.surface = surface;
    shape.volume = volume;

    //
    return shape;
  }
}
