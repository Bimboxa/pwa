import { MeshBasicMaterial, Color, Group } from "three";

import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import wallToRectRing from "Features/geometry/utils/wallToRectRing";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import pixelToWorld from "./pixelToWorld";
import extrudeClosedShape from "./extrudeClosedShape";
import extrudePolylineWall from "./extrudePolylineWall";

// Reduce the rendered wall thickness slightly so its mesh doesn't z-fight
// with overlay annotations laid on top of it later (e.g. wall coverings).
const THICKNESS_SAFETY_FACTOR = 0.95;

// Strip the alpha suffix from #RRGGBBAA hex strings so THREE.Color accepts them.
function normalizeHex(hex) {
  if (typeof hex !== "string") return hex;
  if (hex.length === 9 && hex.startsWith("#")) return hex.slice(0, 7);
  if (hex.length === 5 && hex.startsWith("#")) return hex.slice(0, 4);
  return hex;
}

function makeMaterial(annotation, options) {
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
  const rawOpacity = isStrokeDriven
    ? annotation.strokeOpacity ?? 1
    : annotation.fillOpacity ?? 1;
  const opacity = options?.disableOpacity ? 1 : rawOpacity;
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

// Resolve a STRIP annotation into closed polygons and extrude each one.
// Mirrors what NodeStripStatic does in 2D so the 3D matches the visible 2D
// footprint (closeLine, hiddenSegmentsIdx, cuts).
function extrudeStripPolygons(annotation, baseMap, height, material, verticalLift) {
  const polys = getStripePolygons(annotation, baseMap.meterByPx, true);
  if (!polys || polys.length === 0) return null;
  const group = new Group();
  polys.forEach((poly) => {
    const pts = pointsToLocal(poly.points || [], baseMap);
    const cuts = (poly.cuts || [])
      .map((cut) => pointsToLocal(cut.points || [], baseMap))
      .filter((c) => c.length >= 3);
    const sub = extrudeClosedShape(pts, height, material, cuts, verticalLift);
    if (sub) group.add(sub);
  });
  if (group.children.length === 0) return null;
  return group;
}

// Build the rectangular footprint of a single wall polyline (CM stroke
// width) using the same offset algorithm as the 2D "Contour" action
// (wallToRectRing in useWallBoundaries), then extrude it. Arcs in the
// polyline are first expanded into straight samples so the offset stays
// well-defined.
function extrudeWallPolygon(annotation, baseMap, height, material, verticalLift) {
  const pts = (annotation.points || []).map((p) => ({
    x: p.x,
    y: p.y,
    type: p.type,
  }));
  if (pts.length < 2) return null;

  const expanded = expandArcsInPath(pts, 6);
  const filtered = [expanded[0]];
  for (let i = 1; i < expanded.length; i++) {
    const prev = filtered[filtered.length - 1];
    if (
      Math.abs(expanded[i].x - prev.x) > 0.1 ||
      Math.abs(expanded[i].y - prev.y) > 0.1
    ) {
      filtered.push(expanded[i]);
    }
  }
  if (filtered.length < 2) return null;

  const strokeWidthCm = (annotation.strokeWidth ?? 10) * THICKNESS_SAFETY_FACTOR;
  const meterByPx = baseMap.meterByPx;
  if (!meterByPx || meterByPx <= 0) return null;
  const thicknessPx = strokeWidthCm / (meterByPx * 100);
  const halfWidth = thicknessPx / 2;

  const ring = wallToRectRing(filtered, halfWidth);
  if (!ring || ring.length < 4) return null;

  // ring is GeoJSON-style [[x, y], …, first-repeated]; drop the duplicated
  // closing vertex and convert to {x, y} for pointsToLocal.
  const ringPoints = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
  const local = pointsToLocal(ringPoints, baseMap);
  return extrudeClosedShape(local, height, material, undefined, verticalLift);
}

function applyBaseMapTransform(object, baseMap) {
  const pos = baseMap.position ?? { x: 0, y: 0, z: 0 };
  const rot = baseMap.rotation ?? { x: -Math.PI / 2, y: 0, z: 0 };
  object.position.set(pos.x, pos.y, pos.z);
  object.rotation.set(rot.x, rot.y, rot.z);
}

export default function createAnnotationObject3D(annotation, baseMap, options) {
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
  const material = makeMaterial(annotation, options);

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
      // CM-width polylines have a real-world stroke width — render them as
      // an extruded polygon (using the same offset algorithm as the 2D
      // "Contour" action), instead of a thin wall.
      if (annotation.strokeWidthUnit === "CM") {
        object = extrudeWallPolygon(
          annotation,
          baseMap,
          height,
          material,
          verticalLift
        );
        break;
      }
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
      object = extrudeStripPolygons(
        annotation,
        baseMap,
        height,
        material,
        verticalLift
      );
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
