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

  loadMaps = (maps, options = {}) => {
    try {
      const images = maps.map(getEditorImageFromBaseMap);
      if (typeof options.opacity === "number") {
        images.forEach((img) => {
          img.opacity = options.opacity;
        });
      }
      this.sceneManager.imagesManager.deleteAllImagesObjects();
      this.sceneManager.imagesManager.createImagesObjects(images, maps);
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };

  // annotations

  loadAnnotations = (annotations, options) => {
    try {
      this.sceneManager.annotationsManager.deleteAllAnnotationsObjects();
      this.sceneManager.annotationsManager.createAnnotationsObjects(
        annotations,
        options
      );
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };
}
