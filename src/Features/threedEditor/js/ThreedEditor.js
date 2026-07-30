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

  // rAF-coalesced variant, see SceneManager.requestRender.
  requestRender = () => {
    if (this.sceneIsInitialized) {
      this.sceneManager.requestRender();
    }
  };

  dispose = () => {
    // Stop the camera-controls render loop and release its DOM listeners.
    this.sceneManager?.controlsManager?.dispose?.();
    this.sceneManager?.renderModeManager?.dispose?.();
  };

  // images

  loadMaps = (maps, options = {}) => {
    try {
      // Annotation objects are children of the basemap groups deleted below.
      // They used to be disposed by the annotations hook right after, but the
      // hook now keeps them alive across viewer toggles — a project/main-map
      // switch is the one path that must drop them explicitly (also fixes the
      // latent orphan leak of objects left attached to removed groups).
      this.sceneManager.annotationsManager?.deleteAllAnnotationsObjects();
      // Photo baseMaps (perspective images) are never posed as flat planes:
      // their 3D presence is their calibrated photoPlans (PhotoPlansManager).
      // Keeping them out of baseMapsMap also makes AnnotationsManager skip
      // their non-reconstructed annotations.
      maps = (maps || []).filter((m) => !m?.isPhoto);
      const images = maps.map(getEditorImageFromBaseMap);
      if (typeof options.opacity === "number" || options.opacityByBaseMapId) {
        images.forEach((img) => {
          // Per-baseMap override (properties panel) wins over the global one.
          const o = options.opacityByBaseMapId?.[img.id] ?? options.opacity;
          if (typeof o === "number") img.opacity = o;
        });
      }
      this.sceneManager.imagesManager.deleteAllImagesObjects();
      this.sceneManager.imagesManager.createImagesObjects(images, maps);
      this.sceneManager.clippingManager?.reapply();
      this.sceneManager.renderModeManager?.onSceneStructureChanged();
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
      // Photo baseMaps have no flat-plane representation (see loadMaps).
      if (baseMap.isPhoto) return;
      const imagesManager = this.sceneManager.imagesManager;
      // Always refresh the annotations' baseMap registry, even when the group
      // is already loaded: annotation objects are positioned with
      // baseMapsMap's meterByPx, which may have been stored before the scale
      // was set (creation dialog stores meterByPx null).
      imagesManager.baseMapsMap[baseMap.id] = baseMap;
      const image = getEditorImageFromBaseMap(baseMap);
      if (!image?.url) return;
      // Skip only when the existing mesh matches THIS image — a failed
      // texture load, an active-version switch or a version-transform edit
      // all fall through so addImageObject can rebuild the mesh in place.
      if (imagesManager.hasCurrentImageObject(baseMap.id, image)) return;
      if (typeof options.opacity === "number") image.opacity = options.opacity;
      imagesManager.addImageObject(image, baseMap);
      this.sceneManager.clippingManager?.reapply();
      this.sceneManager.renderModeManager?.onSceneStructureChanged();
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

    // Scale change (e.g. 2-target Recaler, or set-scale after a scale-less
    // creation): rebuild the plane geometry from the pixel-space placement
    // stashed on the group — no image re-resolve, so a raw db record is
    // enough. Also covers a baseMap created WITHOUT a scale (meterByPx null
    // in the creation dialog, 0-sized invisible plane): the geometry comes
    // back at the right size as soon as a valid scale shows up.
    const prevMeterByPx = group.userData?.meterByPx;
    const nextMeterByPx = baseMap.meterByPx;
    if (
      Number.isFinite(nextMeterByPx) &&
      nextMeterByPx > 0 &&
      nextMeterByPx !== prevMeterByPx
    ) {
      imagesManager.updateBaseMapGeometry(baseMap.id, {
        meterByPx: nextMeterByPx,
      });
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
    this.sceneManager.controlsManager.panCameraToWorldPoint(
      worldPoint,
      options
    );
  };

  fitToAnnotations = () => {
    if (!this.sceneIsInitialized) return;
    this.sceneManager.controlsManager.fitToAnnotations();
  };

  fitToAnnotationsTopDown = () => {
    if (!this.sceneIsInitialized) return;
    return this.sceneManager.controlsManager.fitToAnnotationsTopDown();
  };

  fitToBox3Facing = (box, normal, side) => {
    if (!this.sceneIsInitialized) return Promise.resolve(null);
    return this.sceneManager.controlsManager.fitToBox3Facing(box, normal, side);
  };

  // annotations

  loadAnnotations = (annotations, options) => {
    try {
      const annotationsManager = this.sceneManager.annotationsManager;
      // Incremental load: reuse built objects whose resolved annotation
      // reference (stabilized across runs by useAnnotationsV2), build options
      // and basemap metrics are unchanged; dispose removed/changed ones and
      // build only the rest. A no-change emission — e.g. re-entering the 3D
      // viewer without edits — is a full no-op.
      const { toCreate, toRemove } = annotationsManager.diffAnnotations(
        annotations,
        options
      );
      if (toCreate.length === 0 && toRemove.length === 0) return;
      annotationsManager.deleteAnnotationsObjects(toRemove);
      annotationsManager.createAnnotationsObjects(toCreate, options);
      this.sceneManager.clippingManager?.reapply();
      this.sceneManager.renderModeManager?.onSceneStructureChanged();
      this.renderScene();
    } catch (e) {
      console.log("Error", e);
    }
  };
}
