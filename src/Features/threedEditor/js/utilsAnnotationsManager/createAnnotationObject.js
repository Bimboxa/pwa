import {
  MeshBasicMaterial, // REMPLACÉ: MeshPhongMaterial -> MeshBasicMaterial
  Color,
  DoubleSide,
} from "three";

import getPointsIn3dFromPointsInBaseMap from "./getPointsIn3dFromPointsInBaseMap";
import createObject_floorAndWalls from "./createObject_floorAndWalls";
import createObject_volume from "./createObject_volume";

export default function createAnnotationObject(annotation, options) {
  // options

  const applyMaterial = options?.applyMaterial;
  const map = options?.map;

  // edge case
  if (!map || !annotation) return null;

  // Validate that annotation has points
  if (
    !annotation.points ||
    !Array.isArray(annotation.points) ||
    annotation.points.length === 0
  ) {
    console.warn(
      "[createAnnotationObject] Annotation missing valid points array",
      annotation
    );
    return null;
  }

  // color
  const fillColor = annotation.fillColor || annotation.color || "#ffffff";
  const fillOpacity = annotation.fillOpacity ?? 1;
  const color = new Color(fillColor);

  // points in 3d (with image in 0, with no rotation)
  const pointsIn3d = getPointsIn3dFromPointsInBaseMap(annotation.points, map);

  // Guard against empty points array
  if (!pointsIn3d || pointsIn3d.length === 0) {
    console.warn(
      "[createAnnotationObject] No valid 3D points generated",
      annotation
    );
    return null;
  }

  // Preserve type information from original points for arc detection
  const pointsWithType = pointsIn3d.map((point3d, idx) => ({
    ...point3d,
    type: annotation.points[idx]?.type,
  }));

  // Create material
  // FIX: On utilise MeshBasicMaterial au lieu de Phong.
  // Cela garantit que la couleur est visible sous tous les angles sans dépendre de l'éclairage.
  const material =
    applyMaterial ??
    new MeshBasicMaterial({
      color,
      transparent: fillOpacity < 1,
      opacity: fillOpacity,
      side: annotation.shapeCode === "FLOOR_AND_WALLS" ? DoubleSide : undefined,
      // FIX: depthWrite false pour la transparence évite de masquer la carte en arrière-plan
      depthWrite: fillOpacity < 1 ? false : true,
    });

  // Check if this is a FLOOR_AND_WALLS annotation
  if (annotation.shapeCode === "FLOOR_AND_WALLS") {
    const height = annotation.height ? Number(annotation.height) || 1 : 1;
    // Create polyline object with 3D points (including type) and segments
    const polyline = {
      points: pointsWithType,
      segments: annotation.segments || [],
    };
    const floorAndWallsObject = createObject_floorAndWalls(
      polyline,
      height,
      material
    );

    if (!floorAndWallsObject) return null;

    // position & rotation
    const pos = map.position ?? { x: 0, y: 0, z: 0 };
    const rot = map.rotation ?? { x: -Math.PI / 2, y: 0, z: 0 };

    floorAndWallsObject.position.set(pos.x, pos.y, pos.z);
    floorAndWallsObject.rotation.set(rot.x, rot.y, rot.z);

    return floorAndWallsObject;
  }

  // Default behavior: create extruded volume
  const height = annotation.height ? Number(annotation.height) || 1 : 1;
  // Create polyline object with 3D points (including type) and segments
  const polyline = {
    points: pointsWithType,
    segments: annotation.segments || [],
  };
  const volumeObject = createObject_volume(polyline, height, material);

  if (!volumeObject) return null;

  // position & rotation
  const pos = map.position ?? { x: 0, y: 0, z: 0 };
  const rot = map.rotation ?? { x: -Math.PI / 2, y: 0, z: 0 };

  volumeObject.position.set(pos.x, pos.y, pos.z);
  volumeObject.rotation.set(rot.x, rot.y, rot.z);

  // return
  return volumeObject;
}
