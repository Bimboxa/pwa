import Konva from "konva";

import LegendManager from "./LegendManager";
import ImagesManager from "./ImagesManager";
import ShapesManager from "./ShapesManager";
import MarkersManager from "./MarkersManager";

import store from "App/store";
import {
  setEnabledDrawingMode,
  setLoadedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import { setClickedItem } from "Features/listPanel/listPanelSlice";

import getStagePositionAndScaleFromImageSize from "../utils/getStagePositionAndScaleFromImageSize";
import fromMapPropsToImageProps from "./utilsImagesManager/fromMapPropsToImageProps";
import getPinchCenter from "./utilsMapEditor/getPinchCenter";
import getPinchDistance from "./utilsMapEditor/getPinchDistance";
import testPinchEvent from "./utilsMapEditor/testPinchEvent";
import getPointerPositionInStage from "../utils/getPointerPositionInStage";

import bgImageUrl from "../assets/bgImage150dpiA4.png";

export default class MapEditor {
  constructor({ container, width, height, onMapEditorIsReady }) {
    this.scope = null;
    this.stage = new Konva.Stage({ container, draggable: true, width, height });

    //this.offset = { x: 62, y: 62 }; // offset in px = margin of the bgImage.
    this.offset = { x: 70, y: 70 }; // offset in px = margin of the bgImage.

    this.scaleBy = 1.1;
    this.scaleByTouch = 1.05;

    this.printModeEnabled = false;

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

    this.layerFreeline.setZIndex(4);

    this.legendManager = new LegendManager({ mapEditor: this });

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

    // Centralized click handler for all stage items
    this.stage.on("click", (e) => this.handleStageClick(e));

    window.addEventListener("keydown", this.handleKeyDown);

    this._initStageSize({ width, height });

    // subscription to store
    this.unsubsribe = store.subscribe(() => {
      const _showBgImage = store.getState().shower.showBgImage;
      console.log("[SUBSCRIPTION] showBgImage", _showBgImage);
      if (_showBgImage) {
        this.showBgImage();
      } else {
        this.hideBgImage();
      }
    });
  }

  /*
   * INIT
   */

  async _initStageSize({ width, height }) {
    this.stage.width(width);
    this.stage.height(height);
    const image = {
      url: bgImageUrl,
      x: 0,
      y: 0,
      width,
      height,
    };

    //await this.imagesManager.addBgImageNodeAsync(image);
    this.resetStagePositionAndScale();
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

  handleStageClick = (e) => {
    console.log("stage click", e);
    // Get the clicked target
    const target = e.target;

    // Only dispatch if we clicked on a node (not the stage itself)
    if (target && target !== this.stage) {
      // Get the node type/class
      let nodeType = "unknown";
      const nodeId = target._id;

      if (target.getClassName) {
        nodeType = target.getClassName();
      } else if (target.constructor && target.constructor.name) {
        nodeType = target.constructor.name;
      }

      // Dispatch the event on the stage container
      store.dispatch(setClickedItem({ type: nodeId }));
    }
  };

  resizeStage() {
    const bbox = this.stage.container().getBoundingClientRect();
    this.stage.width(bbox.width);
    this.stage.height(bbox.height);
  }

  /*
   *  STAGE
   */

  setStageSize(size) {
    if (!size) return;
    console.log("setStage");
    this.stage.width(size.width);
    this.stage.height(size.height);
    this.resetStagePositionAndScale();
  }

  resetStagePositionAndScale() {
    // Center the stage in its container with objectFit: "contain"
    const containerRect = this.stage.container().getBoundingClientRect();

    // Calculate scale to fit (objectFit: contain)
    const scaleX = containerRect.width / this.stage.width();
    const scaleY = containerRect.height / this.stage.height();
    const scale = Math.min(scaleX, scaleY);

    // Center the content
    const newWidth = this.stage.width() * scale;
    const newHeight = this.stage.height() * scale;
    const x = (containerRect.width - newWidth) / 2;
    const y = (containerRect.height - newHeight) / 2;

    this.stage.position({ x, y });
    this.stage.scale({ x: scale, y: scale });
    this.stage.batchDraw();
  }

  /*
   *  BASE MAP VIEW
   */

  async loadBaseMapView(baseMapView) {
    // debug
    console.log("[MapEditor] loadBaseMapView", baseMapView);

    // init - delete all
    this.imagesManager.deleteAllImagesNodes();

    // set bgImage
    const img = baseMapView.getBgImageForKonva();
    //this.setStageSize(baseMapView.bgImage?.imageSize);
    await this.imagesManager.setBgImageNodeAsync(img);

    // load main base map
    this.loadMainBaseMap(baseMapView.baseMap);
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

    this.imagesManager.deleteMainImageNode();
    await this.imagesManager.createImage2DAsync(baseMap.toKonva(), {
      isMainImage: true,
      center: true,
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

  enableDrawingMode(mode, options) {
    console.log("[MapEditor] enableDrawingMode", mode);
    const shapeProps = options?.presetProps;
    this.stageCursorMemo = this.stage.container().style.cursor;
    this.stage.container().style.cursor = "crosshair";
    this.enabledDrawingMode = mode;

    // options
    const updateRedux = options?.updateRedux ?? false;

    // main
    if (mode === "MARKER") {
      this.markersManager.enableDrawing();
    } else {
      this.shapesManager.enableDrawingMode(mode, shapeProps);
    }

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
    } else if (this.enabledDrawingMode === "MARKER") {
      this.markersManager.disableDrawing();
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
  /*
   * CLICK

  
   */

  /*
   * SELECTION
   */

  resetSelection() {
    this.imagesManager.resetSelection();
  }

  /*
   * PRINT MODE
   */
  showBgImage() {
    this.imagesManager.bgImageNode?.show();
  }

  hideBgImage() {
    this.imagesManager.bgImageNode?.hide();
  }

  enablePrintMode() {
    console.log("[MapEditor] enablePrintMode");
    // this.imagesManager.bgImageNode?.show();
    // this.legendManager.updateLegend();
    // this.printModeEnabled = true;
  }

  disablePrintMode() {
    this.imagesManager.bgImageNode?.hide();
    this.printModeEnabled = false;
    this.legendManager.hideLegend();
  }

  async setBgImage(bgImage) {
    console.log("[MapEditor] setBgImage", bgImage);
    const { imageUrlRemote, imageSize } = bgImage;
    const props = {
      url: imageUrlRemote,
      width: imageSize?.width,
      height: imageSize?.height,
      x: 0,
      y: 0,
    };

    await this.imagesManager.setBgImageNodeAsync(props);
    this.setStageSize(imageSize);
  }

  /*
   * EXPORT
   */

  getStageImageUrl() {
    // Store original stage position and scale
    const originalPosition = this.stage.position();
    const originalScale = this.stage.scale();

    try {
      // Temporarily reset stage to show full content
      this.stage.position({ x: 0, y: 0 });
      this.stage.scale({ x: 1, y: 1 });

      // Force a redraw to ensure all content is visible
      this.stage.batchDraw();

      // Use stage size directly
      const dataUrl = this.stage.toDataURL({
        pixelRatio: 2, // higher quality export
        mimeType: "image/png",
        quality: 1,
        x: 0,
        y: 0,
        width: this.stage.width(),
        height: this.stage.height(),
      });

      return dataUrl;
    } catch (error) {
      console.error("Error generating stage image:", error);
      throw error;
    } finally {
      // Restore original position and scale
      this.stage.position(originalPosition);
      this.stage.scale(originalScale);
      this.stage.batchDraw();
    }
  }
}
