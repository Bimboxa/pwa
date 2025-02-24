import SceneManager from "./SceneManager";

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
