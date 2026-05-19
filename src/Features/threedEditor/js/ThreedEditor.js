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

  // Lazily create a single basemap group if it isn't already in the scene.
  // Used by the live visibility hook so showing an extra basemap doesn't
  // rebuild the whole scene like loadMaps does.
  ensureBaseMapLoaded = (baseMap, options = {}) => {
    try {
      if (!baseMap?.id) return;
      const imagesManager = this.sceneManager.imagesManager;
      if (imagesManager.hasImageObject(baseMap.id)) return;
      const image = getEditorImageFromBaseMap(baseMap);
      if (!image?.url) return;
      if (typeof options.opacity === "number") image.opacity = options.opacity;
      imagesManager.addImageObject(image, baseMap);
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };

  setBaseMapVisibleIn3d = (baseMapId, visible) => {
    this.sceneManager.imagesManager.setBaseMapVisible(baseMapId, visible);
    this.renderScene();
  };

  // camera

  panCameraToWorldPoint = (worldPoint, options) => {
    if (!this.sceneIsInitialized) return;
    this.sceneManager.controlsManager.panCameraToWorldPoint(worldPoint, options);
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
