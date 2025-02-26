import {Shape, ExtrudeGeometry, MeshPhongMaterial, Mesh, Color} from "three";

import getPointsIn3dFromPointsInMap from "./getPointsIn3dFromPointsInMap";

export default function createShapeObjectFromImageObject(shape, options) {
  // options

  const applyMaterial = options?.applyMaterial;
  const map = options?.map;

  // edge case
  if (!map || !shape) return null;

  // color
  const color = new Color(shape.color);

  // points in 3d (with image in 0, with no rotation)
  const pointsIn3d = getPointsIn3dFromPointsInMap(shape.points, map);

  // draw shape
  const shapePoints = pointsIn3d.map((point) => ({x: point.x, y: point.y}));
  const shapeThree = new Shape(shapePoints);
  shapeThree.closePath();

  // extrusion
  const extrudeSettings = {
    depth: shape.height ?? 1,
    bevelEnabled: false,
  };

  const extrudeGeometry = new ExtrudeGeometry(shapeThree, extrudeSettings);
  const extrudeMaterial = applyMaterial ?? new MeshPhongMaterial({color});
  const extrudeMesh = new Mesh(extrudeGeometry, extrudeMaterial);

  // position & rotation
  const pos = map.position ?? {x: 0, y: 0, z: 0};
  const rot = map.rotation ?? {x: -Math.PI / 2, y: 0, z: 0};

  extrudeMesh.position.set(pos.x, pos.y, pos.z);
  extrudeMesh.rotation.set(rot.x, rot.y, rot.z);

  // return
  return extrudeMesh;
}
