import SceneManager from "./SceneManager";

import getEditorImageFromMap from "./utilsImagesManager/getEditorImageFromMap";

export default class ThreedEditor {
  constructor({containerEl, onRendererIsReady}) {
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
      const images = maps.map(getEditorImageFromMap);
      this.sceneManager.imagesManager.deleteAllImagesObjects();
      this.sceneManager.imagesManager.createImagesObjects(images);
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
}
