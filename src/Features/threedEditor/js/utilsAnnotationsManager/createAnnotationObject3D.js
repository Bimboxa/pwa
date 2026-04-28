import { MeshBasicMaterial, Color } from "three";

import pixelToWorld from "./pixelToWorld";
import extrudeClosedShape from "./extrudeClosedShape";
import extrudePolylineWall from "./extrudePolylineWall";

// Strip the alpha suffix from #RRGGBBAA hex strings so THREE.Color accepts them.
function normalizeHex(hex) {
  if (typeof hex !== "string") return hex;
  if (hex.length === 9 && hex.startsWith("#")) return hex.slice(0, 7);
  if (hex.length === 5 && hex.startsWith("#")) return hex.slice(0, 4);
  return hex;
}

function makeMaterial(annotation) {
  const fillColor = normalizeHex(
    annotation.fillColor || annotation.strokeColor || "#cccccc"
  );
  const fillOpacity = annotation.fillOpacity ?? 1;
  return new MeshBasicMaterial({
    color: new Color(fillColor),
    transparent: fillOpacity < 1,
    opacity: fillOpacity,
    depthWrite: fillOpacity >= 1,
  });
}

function pointsToLocal(points, baseMap) {
  return points.map((p) => ({ ...pixelToWorld(p, baseMap), type: p.type }));
}

function bboxToCorners(bbox) {
  const { x, y, width, height } = bbox;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function applyBaseMapTransform(object, baseMap) {
  const pos = baseMap.position ?? { x: 0, y: 0, z: 0 };
  const rot = baseMap.rotation ?? { x: -Math.PI / 2, y: 0, z: 0 };
  object.position.set(pos.x, pos.y, pos.z);
  object.rotation.set(rot.x, rot.y, rot.z);
}

export default function createAnnotationObject3D(annotation, baseMap) {
  if (!annotation || !baseMap) return null;

  const drawingShape3D = annotation.drawingShape3D ?? null;
  if (drawingShape3D !== null) {
    console.warn(
      `[createAnnotationObject3D] Unknown drawingShape3D="${drawingShape3D}", falling back to default`
    );
  }

  const height = Number(annotation.height) || 0;
  const material = makeMaterial(annotation);

  let object = null;
  switch (annotation.type) {
    case "POLYGON": {
      const pts = pointsToLocal(annotation.points || [], baseMap);
      const cuts = (annotation.cuts || [])
        .map((cut) => pointsToLocal(cut.points || [], baseMap))
        .filter((c) => c.length >= 3);
      object = extrudeClosedShape(pts, height, material, cuts);
      break;
    }
    case "RECTANGLE": {
      if (!annotation.bbox) break;
      const pts = pointsToLocal(bboxToCorners(annotation.bbox), baseMap);
      object = extrudeClosedShape(pts, height, material);
      break;
    }
    case "POLYLINE": {
      const pts = pointsToLocal(annotation.points || [], baseMap);
      object = extrudePolylineWall(pts, height, material, !!annotation.closeLine);
      break;
    }
    default:
      return null;
  }

  if (!object) return null;

  applyBaseMapTransform(object, baseMap);
  object.userData = {
    nodeId: annotation.id,
    nodeType: "ANNOTATION",
    annotationType: annotation.type,
    listingId: annotation.listingId,
  };

  return object;
}
