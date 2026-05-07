import createAnnotationObject3D from "./utilsAnnotationsManager/createAnnotationObject3D";

export default class AnnotationsManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.annotationsObjectsMap = {};
    this._annotationReadyCallbacks = new Set();
  }

  // Subscribe to "annotation ready" notifications. Fires once after the sync
  // creation of the 3D object, and again after the async GLB load completes
  // for OBJECT_3D annotations. Returns an unsubscribe function. Used by
  // ThreedSelectionDimmer to re-apply the selection-dim state to GLBs that
  // finish loading after a selection change.
  subscribeAnnotationReady(callback) {
    this._annotationReadyCallbacks.add(callback);
    return () => this._annotationReadyCallbacks.delete(callback);
  }

  _notifyAnnotationReady(id) {
    this._annotationReadyCallbacks.forEach((cb) => {
      try {
        cb(id);
      } catch (e) {
        console.error("[AnnotationsManager] annotation-ready listener threw", e);
      }
    });
  }

  createAnnotationsObjects(annotations, options) {
    if (!annotations) return;

    annotations.forEach((annotation) => {
      const baseMap =
        this.sceneManager.imagesManager.baseMapsMap[annotation.baseMapId];
      if (!baseMap) return;

      // Position/rotation are now carried by the parent basemap Group, so we
      // only need the metrics required to project pixel coords into the
      // basemap-local meter frame.
      const baseMapForRender = {
        imageWidth: baseMap.image?.imageSize?.width || 1,
        imageHeight: baseMap.image?.imageSize?.height || 1,
        meterByPx: baseMap.meterByPx || 0.01,
      };

      const object = createAnnotationObject3D(annotation, baseMapForRender, {
        ...options,
        onAsyncLoaded: () => {
          this.sceneManager.renderScene();
          this._notifyAnnotationReady(annotation.id);
        },
      });
      if (!object) return;

      this.annotationsObjectsMap[annotation.id] = object;
      // Attach to the basemap's group so transforms applied to the basemap
      // (translate/rotate from the BASEMAP_POSITION editor mode) propagate to
      // the annotations for free.
      const group = this.sceneManager.imagesManager.getGroup(annotation.baseMapId);
      (group ?? this.scene).add(object);
      this._notifyAnnotationReady(annotation.id);
    });
  }

  deleteAllAnnotationsObjects() {
    Object.values(this.annotationsObjectsMap).forEach((object) => {
      if (!object) return;
      // Custom cleanup hook (e.g. EXTRUSION_PROFILE Dexie liveQuery
      // subscriptions). Run BEFORE GPU-resource disposal so the callback can
      // still touch the object if needed.
      object.traverse?.((child) => {
        try {
          child.userData?.dispose?.();
        } catch (e) {
          console.error("[AnnotationsManager] dispose hook threw", e);
        }
      });
      // The parent is the basemap group when it exists, the scene otherwise.
      object.parent?.remove(object);
      object.traverse?.((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.annotationsObjectsMap = {};
  }
}
