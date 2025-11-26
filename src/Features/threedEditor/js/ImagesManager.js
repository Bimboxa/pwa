import createImageObjectAsync from "./utilsImagesManager/createImageObject";

export default class ImagesManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    this.scene = this.sceneManager.scene;
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
    images.forEach(async (image) => {
      const object = await createImageObjectAsync(image);
      this.imagesMap[image.id] = object;
      this.scene.add(object);
    });
  }

  deleteAllImagesObjects() {
    try {
      console.log("[ImagesManager] deleteAllImagesObjects");
      Object.values(this.imagesMap).forEach((object) => {
        this.scene.remove(object);
        object.geometry.dispose();
        object.material.dispose();
      });
      this.imagesMap = {};
      this.baseMapsMap = {};
    } catch (e) {
      console.log("Error", e);
    }
  }
}
