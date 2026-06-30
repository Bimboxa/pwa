import SceneManager from "./SceneManager";

import getBaseMapTransform, {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";

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

  dispose = () => {
    // Stop the camera-controls render loop and release its DOM listeners.
    this.sceneManager?.controlsManager?.dispose?.();
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
      this.sceneManager.clippingManager?.reapply();
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
      this.sceneManager.clippingManager?.reapply();
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };

  // Re-apply a basemap's placement (position + rotation, and plane size on a
  // `meterByPx` change) to its already-loaded group, without a full reload.
  // `baseMap` may be a resolved BaseMap or a raw db.baseMaps record — only the
  // plain placement fields are read. No-op if the group isn't loaded.
  applyBaseMapPlacement = (baseMap) => {
    if (!baseMap?.id) return;
    const imagesManager = this.sceneManager?.imagesManager;
    const group = imagesManager?.getGroup(baseMap.id);
    if (!group) return;

    const t = getBaseMapTransform(baseMap);
    const euler = getBaseMapEuler(t);
    // Rotation order BEFORE values (same discipline as createImageObject).
    group.rotation.order = BASE_MAP_ROTATION_ORDER;
    group.position.set(t.position.x, t.position.y, t.position.z);
    group.rotation.set(euler.x, euler.y, euler.z);

    // Scale change (e.g. 2-target Recaler): resize the plane by ratio using
    // the size/scale stashed at creation, so we don't re-resolve image sizes.
    const prevMeterByPx = group.userData?.meterByPx;
    const nextMeterByPx = baseMap.meterByPx;
    const prevSize = group.userData?.sizeInM;
    if (
      Number.isFinite(prevMeterByPx) &&
      Number.isFinite(nextMeterByPx) &&
      prevMeterByPx > 0 &&
      nextMeterByPx !== prevMeterByPx &&
      prevSize
    ) {
      const ratio = nextMeterByPx / prevMeterByPx;
      const widthInM = prevSize.widthInM * ratio;
      const heightInM = prevSize.heightInM * ratio;
      imagesManager.updateBaseMapGeometry(baseMap.id, { widthInM, heightInM });
      group.userData.sizeInM = { widthInM, heightInM };
      group.userData.meterByPx = nextMeterByPx;
    }

    this.renderScene();
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

  fitToAnnotations = () => {
    if (!this.sceneIsInitialized) return;
    this.sceneManager.controlsManager.fitToAnnotations();
  };

  // annotations

  loadAnnotations = (annotations, options) => {
    try {
      this.sceneManager.annotationsManager.deleteAllAnnotationsObjects();
      this.sceneManager.annotationsManager.createAnnotationsObjects(
        annotations,
        options
      );
      this.sceneManager.clippingManager?.reapply();
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };
}
