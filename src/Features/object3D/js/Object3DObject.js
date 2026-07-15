import { Box3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import renderGlbTopViewDataUrl from "Features/object3D/utils/renderGlbTopViewDataUrl";

export default class Object3DObject {
  file;
  fileName;
  fileSize;
  bbox;
  topViewDataUrl;

  constructor({ file, fileName, fileSize, bbox, topViewDataUrl }) {
    this.file = file;
    this.fileName = fileName ?? file?.name;
    this.fileSize = fileSize ?? file?.size;
    this.bbox = bbox;
    this.topViewDataUrl = topViewDataUrl;
  }

  static async create({ file }) {
    const arrayBuffer = await file.arrayBuffer();
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(arrayBuffer, "", resolve, reject);
    });

    const box = new Box3().setFromObject(gltf.scene);
    const bbox = {
      width: box.max.x - box.min.x,
      height: box.max.y - box.min.y,
      depth: box.max.z - box.min.z,
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    };

    const topViewDataUrl = renderGlbTopViewDataUrl({
      object3D: gltf.scene,
      bbox,
    });

    return new Object3DObject({ file, bbox, topViewDataUrl });
  }

  toEntityField = () => ({
    file: this.file,
    fileName: this.fileName,
    fileSize: this.fileSize,
    bbox: this.bbox,
    topViewDataUrl: this.topViewDataUrl,
    isObject3D: true,
  });
}
