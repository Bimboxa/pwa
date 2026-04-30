import createAnnotationObject3D from "./utilsAnnotationsManager/createAnnotationObject3D";

export default class AnnotationsManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.annotationsObjectsMap = {};
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
        onAsyncLoaded: () => this.sceneManager.renderScene(),
      });
      if (!object) return;

      this.annotationsObjectsMap[annotation.id] = object;
      this.scene.add(object);
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
