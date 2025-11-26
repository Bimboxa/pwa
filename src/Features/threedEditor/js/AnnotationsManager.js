import createAnnotationObject from "./utilsAnnotationsManager/createAnnotationObject";

export default class AnnotationsManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;

    this.annotationsMap = {};
    this.annotationsObjectsMap = {};
  }

  createAnnotationsObjects(annotations) {
    console.log("[AnnotationsManager] Creating annotations", annotations);
    try {
      if (!annotations) throw new Error("No annotations provided");

      annotations.forEach((annotation) => {
        // Get the baseMap for this annotation
        const baseMap =
          this.sceneManager.imagesManager.baseMapsMap[annotation.baseMapId];

        if (!baseMap) {
          console.warn(
            `[AnnotationsManager] BaseMap not found for annotation ${annotation.id} with baseMapId ${annotation.baseMapId}`
          );
          return;
        }

        // Prepare map data for createAnnotationObject
        const map = {
          id: baseMap.id,
          imageWidth: baseMap.image?.imageSize?.width || 1,
          imageHeight: baseMap.image?.imageSize?.height || 1,
          meterByPx: baseMap.meterByPx || 0.01,
          position: baseMap.position || { x: 0, y: 0, z: 0 },
          rotation: baseMap.rotation || { x: -Math.PI / 2, y: 0, z: 0 },
        };

        // Create annotation object using the utility function
        const annotationObject = createAnnotationObject(annotation, {
          map,
          applyMaterial: null,
        });

        if (annotationObject) {
          this.annotationsObjectsMap[annotation.id] = annotationObject;
          this.annotationsMap[annotation.id] = annotation;
          this.scene.add(annotationObject);
          console.log("[AnnotationsManager] Annotation created", annotation);
        }
      });
    } catch (e) {
      console.log("Error creating annotations", e);
    }
  }

  deleteAllAnnotationsObjects() {
    try {
      console.log("[AnnotationsManager] deleteAllAnnotationsObjects");
      Object.values(this.annotationsObjectsMap).forEach((object) => {
        if (object) {
          this.scene.remove(object);
          if (object.geometry) object.geometry.dispose();
          if (object.material) object.material.dispose();
        }
      });
      this.annotationsObjectsMap = {};
      this.annotationsMap = {};
    } catch (e) {
      console.log("Error deleting annotations", e);
    }
  }
}
