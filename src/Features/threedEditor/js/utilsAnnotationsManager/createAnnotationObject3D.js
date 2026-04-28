import { MeshBasicMaterial, Color, Group } from "three";

import getStripePolygons from "Features/geometry/utils/getStripePolygons";

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
  // POLYLINE and STRIP are stroke-driven in the data model (no fill props);
  // POLYGON / RECTANGLE are fill-driven. Opacity must follow the matching
  // prop, otherwise stroke-driven types fall back to fillOpacity = undefined
  // and render fully opaque.
  const isStrokeDriven =
    annotation.type === "POLYLINE" || annotation.type === "STRIP";
  const color = normalizeHex(
    isStrokeDriven
      ? annotation.strokeColor || annotation.fillColor || "#cccccc"
      : annotation.fillColor || annotation.strokeColor || "#cccccc"
  );
  const opacity = isStrokeDriven
    ? annotation.strokeOpacity ?? 1
    : annotation.fillOpacity ?? 1;
  return new MeshBasicMaterial({
    color: new Color(color),
    transparent: opacity < 1,
    opacity,
    // depthWrite stays true even when transparent: prevents the rotation
    // flicker caused by unstable z-sorting between overlapping translucent
    // surfaces (Sol vs walls). Trade-off: a transparent surface in front
    // partially occludes a transparent surface behind it, instead of blending
    // through, but the rendering is stable when the camera moves.
    depthWrite: true,
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
  // Vertical lift in basemap-local Z (perpendicular to the basemap plane).
  // After the basemap rotation, this becomes world Y so the annotation rises
  // above the floor. baseMap.position.z is the floor's own height, offsetZ
  // is a per-annotation override on top of it.
  const verticalLift =
    (baseMap.position?.z ?? 0) + (Number(annotation.offsetZ) || 0);
  const material = makeMaterial(annotation);

  let object = null;
  switch (annotation.type) {
    case "POLYGON": {
      const pts = pointsToLocal(annotation.points || [], baseMap);
      const cuts = (annotation.cuts || [])
        .map((cut) => pointsToLocal(cut.points || [], baseMap))
        .filter((c) => c.length >= 3);
      object = extrudeClosedShape(pts, height, material, cuts, verticalLift);
      break;
    }
    case "RECTANGLE": {
      if (!annotation.bbox) break;
      const pts = pointsToLocal(bboxToCorners(annotation.bbox), baseMap);
      object = extrudeClosedShape(pts, height, material, undefined, verticalLift);
      break;
    }
    case "POLYLINE": {
      const pts = pointsToLocal(annotation.points || [], baseMap);
      object = extrudePolylineWall(
        pts,
        height,
        material,
        !!annotation.closeLine,
        verticalLift
      );
      break;
    }
    case "STRIP": {
      // Resolve the strip into one or more closed polygons (with holes) and
      // extrude each like a regular POLYGON.
      const polys = getStripePolygons(annotation, baseMap.meterByPx, true);
      if (!polys || polys.length === 0) return null;
      const stripGroup = new Group();
      polys.forEach((poly) => {
        const pts = pointsToLocal(poly.points || [], baseMap);
        const cuts = (poly.cuts || [])
          .map((cut) => pointsToLocal(cut.points || [], baseMap))
          .filter((c) => c.length >= 3);
        const sub = extrudeClosedShape(pts, height, material, cuts, verticalLift);
        if (sub) stripGroup.add(sub);
      });
      if (stripGroup.children.length === 0) return null;
      object = stripGroup;
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
