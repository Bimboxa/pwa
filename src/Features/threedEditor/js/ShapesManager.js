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
    console.log("[ShapesManager] Creating shapes", shapes);
    try {
      if (!shapes) throw new Error("No shapes provided");

      shapes.forEach((shape, index) => {
        const shapeObject = createShapeObject(shape, {
          map: shape.map,
          applyMaterial: null,
        });

        this.shapesObjectsMap[shape.id] = shapeObject;
        this.shapesMap[shape.id] = shape;

        console.log("[ShapesManager] Shape created", shape);
        this.scene.add(shapeObject);
      });
    } catch (e) {
      console.log("Error", e);
    }
  }
}
