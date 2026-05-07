import { MeshBasicMaterial, Color, Group } from "three";

import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import wallToRectRing, {
  wallToHollowRings,
} from "Features/geometry/utils/wallToRectRing";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import {
  getShape3DKey,
  getShape3DOptionsForType,
} from "Features/annotations/constants/shape3DConfig";

import pixelToWorld from "./pixelToWorld";
import extrudeClosedShape from "./extrudeClosedShape";
import extrudePolylineWall from "./extrudePolylineWall";
import buildRevolutionMesh from "./buildRevolutionMesh";
import buildExtrudedProfileMesh from "./buildExtrudedProfileMesh";
import createObject3DAnnotation from "./createObject3DAnnotation";

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
  return points.map((p) => ({
    ...pixelToWorld(p, baseMap),
    type: p.type,
    offsetBottom: p.offsetBottom ?? 0,
    offsetTop: p.offsetTop ?? 0,
  }));
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
    offsetBottom: p.offsetBottom ?? 0,
    offsetTop: p.offsetTop ?? 0,
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

  // Closed centerline → hollow ring (outer contour + inner contour as a hole),
  // so the wall renders as a closed loop instead of a U. Per-vertex offsets are
  // not propagated here: the inset/outset rings have a different vertex count
  // than the centerline, so there is no straightforward 1:1 mapping yet.
  if (annotation.closeLine && filtered.length >= 3) {
    const rings = wallToHollowRings(filtered, halfWidth);
    if (!rings) return null;
    const outerLocal = pointsToLocal(rings.outer, baseMap);
    const innerLocal = pointsToLocal(rings.inner, baseMap);
    return extrudeClosedShape(
      outerLocal,
      height,
      material,
      [innerLocal],
      verticalLift
    );
  }

  const ring = wallToRectRing(filtered, halfWidth);
  if (!ring || ring.length < 4) return null;

  // ring layout (closing duplicate removed): [left[0..n-1], right[n-1..0]].
  // Each ring corner maps back to one source point in `filtered`, so the
  // per-source offsetBottom / offsetTop carry over to the rectangular
  // footprint without introducing interpolation. Synthetic arc samples that
  // expandArcsInPath produces have no offsets — they fall back to 0.
  const n = filtered.length;
  const open = ring.slice(0, -1);
  const ringPoints = open.map(([x, y], i) => {
    const srcIdx = i < n ? i : (2 * n - 1 - i);
    const src = filtered[srcIdx] || {};
    return {
      x,
      y,
      offsetBottom: src.offsetBottom ?? 0,
      offsetTop: src.offsetTop ?? 0,
    };
  });
  const local = pointsToLocal(ringPoints, baseMap);
  return extrudeClosedShape(local, height, material, undefined, verticalLift);
}

export default function createAnnotationObject3D(annotation, baseMap, options) {
  if (!annotation || !baseMap) return null;

  const shape3DKey = getShape3DKey(annotation.shape3D);
  if (shape3DKey !== null && shape3DKey !== "EXTRUSION_PROFILE") {
    const known = getShape3DOptionsForType(annotation.type).some(
      (o) => o.key === shape3DKey
    );
    if (!known) {
      console.warn(
        `[createAnnotationObject3D] Unknown shape3D.key="${shape3DKey}" for type="${annotation.type}", falling back to default`
      );
    }
  }

  const height = Number(annotation.height) || 0;
  // Vertical lift in basemap-local Z (perpendicular to the basemap plane).
  // The basemap's lay-flat rotation now sits on the parent group, so local Z
  // becomes world Y once the group transform applies. The floor's own world
  // height is owned by the group's position, so verticalLift is purely the
  // per-annotation offsetZ.
  const verticalLift = Number(annotation.offsetZ) || 0;
  const material = makeMaterial(annotation, options);

  let object = null;
  switch (annotation.type) {
    case "POLYGON": {
      const pts = pointsToLocal(annotation.points || [], baseMap);
      const cuts = (annotation.cuts || [])
        .map((cut) => pointsToLocal(cut.points || [], baseMap))
        .filter((c) => c.length >= 3);
      const innerPts = pointsToLocal(annotation.innerPoints || [], baseMap);
      object = extrudeClosedShape(pts, height, material, cuts, verticalLift, innerPts);
      break;
    }
    case "RECTANGLE": {
      if (!annotation.bbox) break;
      const pts = pointsToLocal(bboxToCorners(annotation.bbox), baseMap);
      object = extrudeClosedShape(pts, height, material, undefined, verticalLift);
      break;
    }
    case "POLYLINE": {
      if (shape3DKey === "REVOLUTION") {
        const pts = pointsToLocal(annotation.points || [], baseMap);
        object = buildRevolutionMesh(
          pts,
          material,
          verticalLift,
          annotation.hiddenSegmentsIdx || []
        );
        break;
      }
      if (
        shape3DKey === "EXTRUSION_PROFILE" &&
        annotation.shape3D?.profileTemplateId
      ) {
        const pts = pointsToLocal(annotation.points || [], baseMap);
        object = buildExtrudedProfileMesh(
          pts,
          annotation.shape3D.profileTemplateId,
          material,
          verticalLift,
          annotation.hiddenSegmentsIdx || []
        );
        break;
      }
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
      if (
        shape3DKey === "EXTRUSION_PROFILE" &&
        annotation.shape3D?.profileTemplateId
      ) {
        // Use the strip's neutral/director line (annotation.points) as the
        // sweep guide.
        const pts = pointsToLocal(annotation.points || [], baseMap);
        object = buildExtrudedProfileMesh(
          pts,
          annotation.shape3D.profileTemplateId,
          material,
          verticalLift,
          annotation.hiddenSegmentsIdx || []
        );
        break;
      }
      object = extrudeStripPolygons(
        annotation,
        baseMap,
        height,
        material,
        verticalLift
      );
      break;
    }
    case "OBJECT_3D": {
      // GLB loading is async — return a placeholder Group synchronously and
      // attach the parsed scene when ready. The basemap transform is applied
      // to the placeholder, so the GLB inherits it once added.
      const placeholder = new Group();
      createObject3DAnnotation(annotation, baseMap)
        .then((sub) => {
          if (sub) {
            placeholder.add(sub);
            options?.onAsyncLoaded?.();
          }
        })
        .catch((err) => {
          console.error("[OBJECT_3D] failed to load GLB", err);
        });
      object = placeholder;
      break;
    }
    default:
      return null;
  }

  if (!object) return null;

  // No applyBaseMapTransform here: the annotation is attached as a child of
  // the basemap group, which already owns the basemap's position + rotation.
  // Merge into existing userData so that loader-set hooks (e.g. the
  // EXTRUSION_PROFILE liveQuery `dispose` callback) survive.
  object.userData = {
    ...(object.userData ?? {}),
    nodeId: annotation.id,
    nodeType: "ANNOTATION",
    annotationType: annotation.type,
    listingId: annotation.listingId,
  };

  return object;
}
