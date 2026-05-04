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

      const baseMapForRender = {
        imageWidth: baseMap.image?.imageSize?.width || 1,
        imageHeight: baseMap.image?.imageSize?.height || 1,
        meterByPx: baseMap.meterByPx || 0.01,
        position: baseMap.position || { x: 0, y: 0, z: 0 },
        rotation: baseMap.rotation || { x: -Math.PI / 2, y: 0, z: 0 },
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
      this.scene.add(object);
      this._notifyAnnotationReady(annotation.id);
    });
  }

  deleteAllAnnotationsObjects() {
    Object.values(this.annotationsObjectsMap).forEach((object) => {
      if (!object) return;
      this.scene.remove(object);
      object.traverse?.((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.annotationsObjectsMap = {};
  }
}
