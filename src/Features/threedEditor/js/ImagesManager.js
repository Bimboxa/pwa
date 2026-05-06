import createImageObject from "./utilsImagesManager/createImageObject";

export default class ImagesManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    this.scene = this.sceneManager.scene;
    // Each entry is a THREE.Group wrapping the basemap mesh + its annotations.
    // Annotations look up their parent group here at attach time.
    this.imagesMap = {};
    this.baseMapsMap = {}; // Store original baseMaps for annotations
  }

  createImagesObjects(images, baseMaps) {
    console.log("[ImagesManager] createImagesObjects", images);
    // Store baseMaps if provided
    if (baseMaps) {
      baseMaps.forEach((baseMap) => {
        this.baseMapsMap[baseMap.id] = baseMap;
      });
    }
    images.forEach((image) => {
      const { group, ready } = createImageObject(image);
      this.imagesMap[image.id] = group;
      this.scene.add(group);
      // Re-render once the texture is in. The group is already in the scene
      // graph so any annotations attached in the meantime are rendered too.
      ready
        .then(() => this.sceneManager.renderScene())
        .catch((e) => console.error("[ImagesManager] texture load failed", e));
    });
  }

  // Look up a basemap's group (parent for annotations attached to that map).
  getGroup(baseMapId) {
    return this.imagesMap[baseMapId] ?? null;
  }

  deleteAllImagesObjects() {
    try {
      console.log("[ImagesManager] deleteAllImagesObjects");
      Object.values(this.imagesMap).forEach((group) => {
        // The group can carry annotations as siblings of the mesh; dispose only
        // the basemap's own mesh resources, not the annotations'
        // (AnnotationsManager owns those).
        this.scene.remove(group);
        group.children.forEach((child) => {
          if (child.userData?.isBasemap) {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
          }
        });
      });
      this.imagesMap = {};
      this.baseMapsMap = {};
    } catch (e) {
      console.log("Error", e);
    }
  }
}
