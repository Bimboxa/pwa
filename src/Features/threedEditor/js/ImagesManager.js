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
    images.forEach((image) => this.addImageObject(image));
  }

  // Create + add a single basemap group. Idempotent: a no-op if a group for
  // this basemap already exists, so it can be called lazily the first time a
  // basemap is shown without reloading the rest of the scene.
  addImageObject(image, baseMap) {
    if (!image || this.imagesMap[image.id]) return;
    if (baseMap) this.baseMapsMap[baseMap.id] = baseMap;
    const { group, ready } = createImageObject(image);
    this.imagesMap[image.id] = group;
    this.scene.add(group);
    // Re-render once the texture is in. The group is already in the scene
    // graph so any annotations attached in the meantime are rendered too.
    ready
      .then(() => this.sceneManager.renderScene())
      .catch((e) => console.error("[ImagesManager] texture load failed", e));
  }

  hasImageObject(baseMapId) {
    return Boolean(this.imagesMap[baseMapId]);
  }

  // Toggle a cached basemap group's visibility without removing it from the
  // scene, so re-showing it later is a cheap flag flip (no texture reload).
  setBaseMapVisible(baseMapId, visible) {
    const group = this.imagesMap[baseMapId];
    if (group) group.visible = visible;
  }

  // Look up a basemap's group (parent for annotations attached to that map).
  getGroup(baseMapId) {
    return this.imagesMap[baseMapId] ?? null;
  }

  // The inner mesh wrapper carrying the live `drawingOffset` translation
  // along the plane's local normal. Annotations stay outside of it.
  getMeshWrap(baseMapId) {
    return this.imagesMap[baseMapId]?.userData?.meshWrap ?? null;
  }

  deleteAllImagesObjects() {
    try {
      console.log("[ImagesManager] deleteAllImagesObjects");
      Object.values(this.imagesMap).forEach((group) => {
        // The group can carry annotations as siblings of the mesh wrapper;
        // dispose only the basemap's own mesh resources, not the
        // annotations' (AnnotationsManager owns those). Walk into the
        // meshWrap to find the basemap mesh.
        this.scene.remove(group);
        group.traverse?.((child) => {
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
