import createImageObjectAsync from "./utilsImagesManager/createImageObject";

export default class ImagesManager {
  constructor({sceneManager}) {
    this.sceneManager = sceneManager;

    this.scene = this.sceneManager.scene;
    this.imagesMap = {};
  }

  createImagesObjects(images) {
    console.log("[ImagesManager] createImagesObjects", images);
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
    } catch (e) {
      console.log("Error", e);
    }
  }
}
