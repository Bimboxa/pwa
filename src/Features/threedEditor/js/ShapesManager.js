import {MeshPhongMaterial} from "three";

import createShapeObject from "./utilsShapesManager/createShapeObject";

export default class ShapesManager {
  constructor({sceneManager}) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;

    this.shapesMap = {};
    this.shapesObjectsMap = {};

    this.defaultMaterial = new MeshPhongMaterial({color: 0x00ff00});
  }

  createShapesObjects(shapes) {
    try {
      shapes.forEach((shape, index) => {
        const shapeObject = createShapeObject(shape, {
          applyMaterial: this.defaultMaterial,
        });

        this.shapesObjectsMap[shape.id] = shapeObject;
        this.shapesMap[shape.id] = shape;

        this.scene.add(shapeObject);
      });
    } catch (e) {
      console.log("Error", e);
    }
  }
}
