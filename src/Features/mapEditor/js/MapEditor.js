import Konva from "konva";

import ImagesManager from "./ImagesManager";
import ShapesManager from "./ShapesManager";
import MarkersManager from "./MarkersManager";

import store from "App/store";
import {
  setEnabledDrawingMode,
  setLoadedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";

import getStagePositionAndScaleFromImageSize from "../utils/getStagePositionAndScaleFromImageSize";
import fromMapPropsToImageProps from "./utilsImagesManager/fromMapPropsToImageProps";
import getPinchCenter from "./utilsMapEditor/getPinchCenter";
import getPinchDistance from "./utilsMapEditor/getPinchDistance";
import testPinchEvent from "./utilsMapEditor/testPinchEvent";
import getPointerPositionInStage from "../utils/getPointerPositionInStage";

export default class MapEditor {
  constructor({ container, width, height, onMapEditorIsReady }) {
    this.stage = new Konva.Stage({ container, draggable: true, width, height });

    this.scaleBy = 1.1;
    this.scaleByTouch = 1.05;

    this.layerImages = new Konva.Layer();
    this.layerShapes = new Konva.Layer();
    this.layerMarkers = new Konva.Layer();
    this.layerEditedShape = new Konva.Layer();
    this.layerFreeline = new Konva.Layer();

    this.stage.add(this.layerImages);
    this.stage.add(this.layerShapes);
    this.stage.add(this.layerMarkers);
    this.stage.add(this.layerEditedShape);
    this.stage.add(this.layerFreeline);

    this.layerFreeline.setZIndex(10);

    this.imagesManager = new ImagesManager({
      mapEditor: this,
      onMapEditorIsReady,
    });

    this.shapesManager = new ShapesManager({
      mapEditor: this,
      onMapEditorIsReady,
    });

    this.markersManager = new MarkersManager({
      mapEditor: this,
    });

    this.stageCursorMemo = null;

    this.enabledDrawingMode = null;

    this.isDraggingStage = false;
    this.lastPinchCenter = null;
    this.lastPinchDistance = null;

    this.stage.on("wheel", (e) => this.handleWheelEvent(e));
    this.stage.on("touchstart", (e) => this.handleTouchStart(e));
    this.stage.on("touchmove", (e) => this.handleTouchMove(e));
    this.stage.on("touchend", (e) => this.handleTouchEnd(e));
    this.stage.on("dragstart", () => (this.isDraggingStage = true));
    this.stage.on("dragend", () => (this.isDraggingStage = false));

    window.addEventListener("keydown", this.handleKeyDown);
  }

  /*
   * listeners
   */

  handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (this.enabledDrawingMode && !this.shapesManager.getIsDrawing()) {
        this.disableDrawingMode({ updateRedux: true });
        if (this.stageCursorMemo) {
          this.stage.container().style.cursor = this.stageCursorMemo;
        }
      } else if (!this.enableDrawingMode) {
        this.stage.container().style.cursor = "default";
      }
    }
  };

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

    this.stage.scale({ x: newScale, y: newScale });

    var newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    this.stage.position(newPos);
    this.stage.batchDraw();

    this.resizeNodes();
  };

  handleTouchStart = (e) => {
    if (testPinchEvent(e.evt)) {
      this.lastPinchCenter = getPinchCenter(e.evt.touches);
      this.lastPinchDistance = getPinchDistance(e.evt.touches);
      this.stage.draggable(false);
    }
  };

  handleTouchMove = (e) => {
    const evt = e.evt;
    const oldScale = this.stage.scaleX();
    if (testPinchEvent(evt)) {
      // last pinchCenter
      const lastPinchCenterInStage = getPointerPositionInStage(
        this.lastPinchCenter,
        this.stage
        //{coordsInWindow: true}
      );

      // scale
      const pinchDistance = getPinchDistance(evt.touches);
      const delta = pinchDistance - this.lastPinchDistance;
      const newScale =
        delta > 0 ? oldScale * this.scaleByTouch : oldScale / this.scaleByTouch;

      this.stage.scale({ x: newScale, y: newScale });

      // position

      const newPos = {
        x: this.lastPinchCenter.x - lastPinchCenterInStage.x * newScale,
        y: this.lastPinchCenter.y - lastPinchCenterInStage.y * newScale,
      };

      this.stage.position(newPos);
      this.stage.batchDraw();
      this.lastPinchDistance = pinchDistance;
    }
  };

  handleTouchEnd = (e) => {
    if (!this.isDraggingStage) {
      this.lastPinchCenter = null;
      this.lastPinchDistance = null;
      this.stage.draggable(true);
      this.resizeNodes();
    }
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
    const imageSize = { width, height };
    const { x, y, scale } = getStagePositionAndScaleFromImageSize(
      this.stage,
      imageSize
    );
    console.log("[MapEditor] refresh", { x, y, scale });
    this.stage.position({ x, y });
    this.stage.scale({ x: scale, y: scale });
  }

  // main image

  async loadMainBaseMap(baseMap) {
    console.log("[MapEditor] loadMainBaseMap", baseMap);
    const imageProps = fromMapPropsToImageProps(baseMap);
    this.imagesManager.deleteAllImagesNodes();
    await this.imagesManager.createImageNodeAsync(imageProps, {
      isMainImage: true,
    });
    store.dispatch(setLoadedMainBaseMapId(baseMap.id));
  }
  // shapes

  loadShapes(shapes) {
    this.shapesManager.deleteAllShapesNodes();
    this.shapesManager.createShapesNodes(shapes);
  }

  // markers

  loadMarkers(markers) {
    this.markersManager.deleteAllMarkersNodes();
    this.markersManager.createMarkersNodes(markers);
  }

  // ------ draw ------

  enableDrawingMode(mode, shapeProps, options) {
    console.log("[MapEditor] enableDrawingMode", mode);
    this.stageCursorMemo = this.stage.container().style.cursor;
    this.stage.container().style.cursor = "crosshair";
    this.enabledDrawingMode = mode;

    // options
    const updateRedux = options?.updateRedux ?? false;

    // main
    this.shapesManager.enableDrawingMode(mode, shapeProps);

    // redux
    if (updateRedux) {
      store.dispatch(setEnabledDrawingMode(mode));
    }
  }

  disableDrawingMode(options) {
    // options
    const updateRedux = options?.updateRedux ?? false;

    // main
    if (this.enabledDrawingMode === "POYGON") {
      this.shapesManager.polygonDrawer.disableDrawing();
    }

    // post process
    this.enabledDrawingMode = null;
    if (updateRedux) {
      store.dispatch(setEnabledDrawingMode(null));
    }
  }

  // ------ resize ------

  resizeNodes() {
    this.markersManager.resizeMarkersNodes();
  }

  // ------- cursor -------

  setStageCursor(cursor) {
    this.stageCursorMemo = this.stage.container().style.cursor;
    this.stage.container().style.cursor = cursor;
  }
  resetStageCursor() {
    this.stage.container().style.cursor = this.stageCursorMemo || "default";
  }
}
