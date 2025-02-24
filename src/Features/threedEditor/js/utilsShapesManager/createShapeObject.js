import * as THREE from "three";

export default function createShapeObject(shape, options) {
  try {
    // options

    const applyMaterial = options?.applyMaterial;

    // main

    const coords2d = shape.points;
    const zInf = shape.zInf;
    const height = shape.height;
    const shapeId = shape.id;
    //const color = new THREE.Color(shape.color);

    // Ensure coords2d is an array of objects with x and y properties
    if (
      !Array.isArray(coords2d) ||
      coords2d.length === 0 ||
      !coords2d[0].hasOwnProperty("x") ||
      !coords2d[0].hasOwnProperty("y")
    ) {
      throw new Error("Invalid shape points");
    }

    const _shape = new THREE.Shape(
      coords2d.map((point) => new THREE.Vector2(point.x, point.y))
    );

    const extrudeSettings = {depth: height, bevelEnabled: false};
    const geometry = new THREE.ExtrudeGeometry(_shape, extrudeSettings);

    let material = applyMaterial;
    if (!material) material = new THREE.MeshPhongMaterial({color: 0xff0000});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = zInf;

    mesh.userData.shapeId = shapeId;

    return mesh;
  } catch (error) {
    console.error("createShapeObject", error);
  }
}
