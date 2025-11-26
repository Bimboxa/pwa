import {
  MeshBasicMaterial, // REMPLACÉ: MeshPhongMaterial -> MeshBasicMaterial
  Color,
  DoubleSide,
} from "three";

import getPointsIn3dFromPointsInBaseMap from "./getPointsIn3dFromPointsInBaseMap";
import createObject_floorAndWalls from "./createObject_floorAndWalls";
import createObject_volume from "./createObject_volume";
import createObject_cone from "./createObject_cone";

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

  // Helper function to apply position and rotation
  const applyTransform = (object, pos, rot) => {
    object.position.set(pos.x, pos.y, pos.z);
    object.rotation.set(rot.x, rot.y, rot.z);
  };

  // Helper function to set userData for raycasting
  const setUserData = (object) => {
    if (object) {
      object.userData = {
        nodeId: annotation.id,
        nodeType: "ANNOTATION",
        annotationType: annotation.type || "POLYLINE",
        listingId: annotation.listingId,
      };
    }
  };

  const pos = map.position ?? { x: 0, y: 0, z: 0 };
  const rot = map.rotation ?? { x: -Math.PI / 2, y: 0, z: 0 };

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

    applyTransform(floorAndWallsObject, pos, rot);
    setUserData(floorAndWallsObject);
    return floorAndWallsObject;
  }

  // Check if this is a CONE annotation
  if (annotation.shapeCode === "CONE") {
    const height = annotation.height ? Number(annotation.height) || 1 : 1;
    const cuts = annotation.cuts || [];

    // Validate that we have at least one cut
    if (!cuts.length || !cuts[0]?.points || cuts[0].points.length < 3) {
      console.warn(
        "[createAnnotationObject] CONE annotation missing valid first cut",
        annotation
      );
      return null;
    }

    // Convert cut points to 3D coordinates and preserve type information
    const cuts3d = cuts.map((cut) => {
      if (!cut.points || !Array.isArray(cut.points)) return cut;

      const cutPoints3d = getPointsIn3dFromPointsInBaseMap(cut.points, map);
      const cutPointsWithType = cutPoints3d.map((point3d, idx) => ({
        ...point3d,
        type: cut.points[idx]?.type,
      }));

      return {
        ...cut,
        points: cutPointsWithType,
      };
    });

    // Create polyline object with 3D points (including type), segments, and cuts
    const polyline = {
      points: pointsWithType,
      segments: annotation.segments || [],
      cuts: cuts3d,
    };

    const coneObject = createObject_cone(polyline, height, material);

    if (!coneObject) return null;

    applyTransform(coneObject, pos, rot);
    setUserData(coneObject);
    return coneObject;
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

  applyTransform(volumeObject, pos, rot);
  setUserData(volumeObject);
  return volumeObject;
}
