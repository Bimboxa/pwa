import { MeshLambertMaterial, Color, Group } from "three";

import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import wallToRectRing, {
  wallToHollowRings,
} from "Features/geometry/utils/wallToRectRing";
import {
  expandArcsInPath,
  expandArcsInPathWithHiddenMap,
} from "Features/geometry/utils/arcSampling";
import stripSlidingFromAnnotation from "Features/annotations/utils/stripSlidingFromAnnotation";

// Match the codebase convention used by other arc-aware paths.
const GUIDE_ARC_SAMPLES = 6;

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

// Inward contraction (per side) applied to CM-width POLYLINE footprints when
// the "Réduire le crénelage des parements" setting is on, so a parement drawn
// flush against a wall no longer shares a coplanar face (kills the aliasing
// shimmer). Applied as a half-width reduction + open-polyline end trim.
const ANTI_ALIASING_SHRINK_MM = 5;

// Move the first/last point of an open polyline inward along its own end
// segment by `shrinkPx`, clamped to 40% of that segment so it never crosses
// the adjacent vertex. Preserves array length (and thus the per-vertex
// offsetBottom/offsetTop mapping the caller relies on).
function shrinkPolylineEnds(points, shrinkPx) {
  if (shrinkPx <= 0 || points.length < 2) return points;
  const out = points.map((p) => ({ ...p }));
  const move = (fromIdx, towardIdx) => {
    const a = out[fromIdx];
    const b = out[towardIdx];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const d = Math.min(shrinkPx, len * 0.4);
    a.x += (dx / len) * d;
    a.y += (dy / len) * d;
  };
  move(0, 1);
  move(points.length - 1, points.length - 2);
  return out;
}

// Strip the alpha suffix from #RRGGBBAA hex strings so THREE.Color accepts them.
function normalizeHex(hex) {
  if (typeof hex !== "string") return hex;
  if (hex.length === 9 && hex.startsWith("#")) return hex.slice(0, 7);
  if (hex.length === 5 && hex.startsWith("#")) return hex.slice(0, 4);
  return hex;
}

export function makeMaterial(annotation, options) {
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
    ? (annotation.strokeOpacity ?? 1)
    : (annotation.fillOpacity ?? 1);
  const opacity = options?.disableOpacity ? 1 : rawOpacity;
  // MeshLambertMaterial (was MeshBasicMaterial): diffuse shading reacts to the
  // scene lights, so a sloped/ramped top face reads as a 3D surface (the mesh
  // already computes smooth vertex normals). Flat annotations stay uniformly
  // lit thanks to the hemisphere light from above.
  const baseColor = new Color(color);
  return new MeshLambertMaterial({
    color: baseColor,
    // Self-illumination at a fraction of the surface's own color: lifts the
    // overall brightness (otherwise the lit result reads too dark) while
    // keeping the directional/hemisphere gradient that conveys the 3D form.
    emissive: baseColor.clone(),
    emissiveIntensity: 0.45,
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
function extrudeStripPolygons(
  annotation,
  baseMap,
  height,
  material,
  verticalLift
) {
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
function extrudeWallPolygon(
  annotation,
  baseMap,
  height,
  material,
  verticalLift,
  options
) {
  const pts = (annotation.points || []).map((p) => ({
    x: p.x,
    y: p.y,
    type: p.type,
    offsetBottom: p.offsetBottom ?? 0,
    offsetTop: p.offsetTop ?? 0,
  }));
  if (pts.length < 2) return null;

  const expanded = expandArcsInPath(pts, 6, !!annotation.closeLine);
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

  const strokeWidthCm =
    (annotation.strokeWidth ?? 10) * THICKNESS_SAFETY_FACTOR;
  const meterByPx = baseMap.meterByPx;
  if (!meterByPx || meterByPx <= 0) return null;
  const thicknessPx = strokeWidthCm / (meterByPx * 100);
  const halfWidth = thicknessPx / 2;

  // Contract the footprint inward so a parement flush against a wall no longer
  // shares a coplanar face (z-fighting / aliasing). Done the cheap way: pull
  // each side in by `shrinkPx` (half-width reduction) and, for open polylines,
  // trim the two end caps inward by the same amount. Clamped so it never
  // collapses / inverts a thin wall.
  const shrinkPx = options?.antiAliasingShrink
    ? ANTI_ALIASING_SHRINK_MM / 1000 / meterByPx
    : 0;
  const effHalfWidth =
    halfWidth - shrinkPx > halfWidth * 0.15 ? halfWidth - shrinkPx : halfWidth;
  const applyShrink = shrinkPx > 0 && effHalfWidth < halfWidth;

  // Closed centerline → hollow ring (outer contour + inner contour as a hole),
  // so the wall renders as a closed loop instead of a U. Per-vertex offsets are
  // not propagated here: the inset/outset rings have a different vertex count
  // than the centerline, so there is no straightforward 1:1 mapping yet.
  if (annotation.closeLine && filtered.length >= 3) {
    const rings = wallToHollowRings(filtered, effHalfWidth);
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

  // Open polyline: trim the two end caps inward as well so the contraction is
  // uniform on all sides. Length is preserved (and per-vertex offsets copied),
  // so the srcIdx → offsetBottom/offsetTop mapping below still holds.
  const wallPts = applyShrink
    ? shrinkPolylineEnds(filtered, shrinkPx)
    : filtered;

  const ring = wallToRectRing(wallPts, effHalfWidth);
  if (!ring || ring.length < 4) return null;

  // ring layout (closing duplicate removed): [left[0..n-1], right[n-1..0]].
  // Each ring corner maps back to one source point in `wallPts`, so the
  // per-source offsetBottom / offsetTop carry over to the rectangular
  // footprint without introducing interpolation. Synthetic arc samples that
  // expandArcsInPath produces have no offsets — they fall back to 0.
  const n = wallPts.length;
  const open = ring.slice(0, -1);
  const ringPoints = open.map(([x, y], i) => {
    const srcIdx = i < n ? i : 2 * n - 1 - i;
    const src = wallPts[srcIdx] || {};
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

  // Strip auto-generated "sliding" refs from the outer contour (and remap
  // hiddenSegmentsIdx), then strip them from cuts / innerPoints inline. The
  // 3D mesh always operates on the underlying raw geometry — sliding refs
  // are decorations re-derived at commit time and must not feed into mesh
  // construction (this also keeps sub-mode mesh modifications stable when
  // adjacent segments carry sliding points).
  const stripped = stripSlidingFromAnnotation(annotation);
  const filterSliding = (refs) => (refs || []).filter((r) => !r?.isSliding);
  annotation = {
    ...annotation,
    points: stripped.points,
    hiddenSegmentsIdx: stripped.hiddenSegmentsIdx,
    cuts: (annotation.cuts || []).map((cut) => ({
      ...cut,
      points: filterSliding(cut?.points),
    })),
    innerPoints: filterSliding(annotation.innerPoints),
  };

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
      object = extrudeClosedShape(
        pts,
        height,
        material,
        cuts,
        verticalLift,
        innerPts,
        {
          isoLines: !!annotation.guideLines?.some(
            (g) => g?.points?.length >= 2
          ),
        }
      );
      break;
    }
    case "RECTANGLE": {
      if (!annotation.bbox) break;
      const pts = pointsToLocal(bboxToCorners(annotation.bbox), baseMap);
      object = extrudeClosedShape(
        pts,
        height,
        material,
        undefined,
        verticalLift
      );
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
        // Sample S-C-S arcs in the guide so the swept surface follows the
        // curve (otherwise the 3 anchor points produce a 2-segment polyline).
        const { points: expandedPts, hiddenSegmentsIdx: expandedHidden } =
          expandArcsInPathWithHiddenMap(
            annotation.points || [],
            GUIDE_ARC_SAMPLES,
            annotation.hiddenSegmentsIdx || [],
            !!annotation.closeLine
          );
        const pts = pointsToLocal(expandedPts, baseMap);
        object = buildExtrudedProfileMesh(
          pts,
          annotation.shape3D.profileTemplateId,
          material,
          verticalLift,
          expandedHidden,
          annotation.extrusionOrientation,
          !!annotation.closeLine
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
          verticalLift,
          options
        );
        break;
      }
      const { points: expanded, hiddenSegmentsIdx: expandedHidden } =
        expandArcsInPathWithHiddenMap(
          annotation.points || [],
          GUIDE_ARC_SAMPLES,
          annotation.hiddenSegmentsIdx || [],
          !!annotation.closeLine
        );
      const pts = pointsToLocal(expanded, baseMap);
      object = extrudePolylineWall(
        pts,
        height,
        material,
        !!annotation.closeLine,
        verticalLift,
        expandedHidden
      );
      break;
    }
    case "STRIP": {
      if (
        shape3DKey === "EXTRUSION_PROFILE" &&
        annotation.shape3D?.profileTemplateId
      ) {
        // Use the strip's neutral/director line (annotation.points) as the
        // sweep guide. Sample S-C-S arcs the same way as the POLYLINE branch.
        const { points: expandedPts, hiddenSegmentsIdx: expandedHidden } =
          expandArcsInPathWithHiddenMap(
            annotation.points || [],
            GUIDE_ARC_SAMPLES,
            annotation.hiddenSegmentsIdx || [],
            !!annotation.closeLine
          );
        const pts = pointsToLocal(expandedPts, baseMap);
        object = buildExtrudedProfileMesh(
          pts,
          annotation.shape3D.profileTemplateId,
          material,
          verticalLift,
          expandedHidden,
          annotation.extrusionOrientation,
          !!annotation.closeLine
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

  // For closed faces (POLYGON / RECTANGLE), expose a vertexRefs array on
  // userData so the hover/click raycaster can address individual vertices /
  // edges by their pointId. Order matches annotation.points[] (extrudeClosedShape
  // / triangulateAnnotationGeometry preserve this order). Positions are in
  // basemap-local space; convert with annoObject.localToWorld at consumption.
  let vertexRefs = null;
  if (annotation.type === "POLYGON" || annotation.type === "RECTANGLE") {
    const sourcePoints =
      annotation.type === "RECTANGLE"
        ? bboxToCorners(annotation.bbox || { x: 0, y: 0, width: 0, height: 0 })
        : annotation.points || [];
    const localPts = pointsToLocal(sourcePoints, baseMap);
    // Basemap-local space: X/Y are planar, Z is the normal (offsetTop /
    // verticalLift apply to Z). The basemap group's rotation then maps
    // local Z to world Y at render time.
    vertexRefs = localPts.map((local, i) => ({
      pointId: sourcePoints[i]?.id ?? null,
      position: {
        x: local.x,
        y: local.y,
        z: (local.z ?? 0) + verticalLift + (local.offsetTop ?? 0),
      },
      index: i,
    }));
  }

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
    vertexRefs,
  };

  return object;
}
