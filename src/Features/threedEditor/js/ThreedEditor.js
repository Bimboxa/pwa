import SceneManager from "./SceneManager";

import getEditorImageFromBaseMap from "./utilsImagesManager/getEditorImageFromBaseMap";

export default class ThreedEditor {
  constructor({ containerEl, onRendererIsReady }) {
    this.containerEl = containerEl;

    this.sceneManager = new SceneManager({
      containerEl,
      onRendererIsReady,
    });
  }

  // initialize

  init = () => {
    this.sceneManager.initScene();
    this.sceneIsInitialized = true;
  };

  renderScene = () => {
    if (this.sceneIsInitialized) {
      this.sceneManager.renderScene();
    }
  };

  // images

  loadMaps = (maps) => {
    try {
      const images = maps.map(getEditorImageFromBaseMap);
      this.sceneManager.imagesManager.deleteAllImagesObjects();
      this.sceneManager.imagesManager.createImagesObjects(images, maps);
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };

  // shapes

  loadShapes = (shapes) => {
    try {
      this.sceneManager.shapesManager.createShapesObjects(shapes);
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };

  // annotations

  loadAnnotations = (annotations) => {
    try {
      this.sceneManager.annotationsManager.deleteAllAnnotationsObjects();
      this.sceneManager.annotationsManager.createAnnotationsObjects(
        annotations
      );
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };
}
