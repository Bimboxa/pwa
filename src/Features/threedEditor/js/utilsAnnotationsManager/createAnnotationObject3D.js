import {
  MeshLambertMaterial,
  Color,
  Group,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  DoubleSide,
  LineSegments,
  LineBasicMaterial,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import getStripePolygons, {
  getStripDistancePx,
  getStripChunks,
  ARC_SAMPLES,
} from "Features/geometry/utils/getStripePolygons";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import buildSlopedStripMesh, {
  getSlopedStripRibbons,
} from "Features/geometry/utils/buildSlopedStripMesh";
import wallToRectRing, {
  wallToHollowRings,
} from "Features/geometry/utils/wallToRectRing";
import shrinkPolylineEnds from "Features/geometry/utils/shrinkPolylineEnds";
import {
  expandArcsInPath,
  expandArcsInPathWithHiddenMap,
  expandRingWithOffsetsAndHiddenMap,
} from "Features/geometry/utils/arcSampling";
import stripSlidingFromAnnotation from "Features/annotations/utils/stripSlidingFromAnnotation";
import shadeMeshCellColor from "Features/mesh/utils/meshCellColor";
import {
  createAnnotationPbrMaterial,
  createMaterial3dMaterial,
} from "Features/photorealRender/utils/pbrMaterials";
import { createAquarelleMaterial } from "../postfx/aquarelleMaterials";

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
import getRevolutionPhi from "./getRevolutionPhi";
import buildExtrudedProfileMesh from "./buildExtrudedProfileMesh";
import createObject3DAnnotation from "./createObject3DAnnotation";

// Screen-space thickness (px) of the vertical "trait" rendered for a POINT
// annotation with a height — matches DrawingOverlayThreed's LINEWIDTH_TRAIT.
const POINT_TRAIT_LINEWIDTH_PX = 3;

// Picking tolerance for the POINT trait, as a fraction of the camera→hit
// distance (≈0.008 rad ≈ a handful of screen px at the editor's FOV), with a
// 2 cm floor so very near traits stay pickable.
const POINT_TRAIT_PICK_ANGULAR = 0.008;
const POINT_TRAIT_PICK_MIN_M = 0.02;

// Reused temporaries for the POINT trait raycast (avoid per-call allocation).
const _ptA = new Vector3();
const _ptB = new Vector3();
const _ptOnRay = new Vector3();
const _ptOnSeg = new Vector3();

// Give a POINT trait Line2 a custom raycast that does NOT rely on three's
// screen-space LineSegments2.raycast: that path needs material.resolution +
// raycaster.params.Line2.threshold to be usable (and historically threw when a
// stale prebundle left resolution undefined, which broke ALL scene picking
// since intersectObjects iterates every object). Here we measure the ray's
// distance to the trait segment in world space and accept the hit within a
// distance-scaled tolerance, pushing a Mesh-shaped intersection so the existing
// `i.object.isMesh` hover/click filter keeps it (Line2 extends Mesh).
function attachPointTraitRaycast(line, localStart, localEnd) {
  line.raycast = function (raycaster, intersects) {
    const ray = raycaster.ray;
    _ptA.copy(localStart).applyMatrix4(this.matrixWorld);
    _ptB.copy(localEnd).applyMatrix4(this.matrixWorld);
    const distSq = ray.distanceSqToSegment(_ptA, _ptB, _ptOnRay, _ptOnSeg);
    const dist = ray.origin.distanceTo(_ptOnSeg);
    const threshold = Math.max(
      POINT_TRAIT_PICK_MIN_M,
      POINT_TRAIT_PICK_ANGULAR * dist
    );
    if (distSq <= threshold * threshold) {
      intersects.push({
        distance: dist,
        point: _ptOnSeg.clone(),
        object: this,
      });
    }
  };
}

// Factor applied to back-faces (the interior of a cavity / CSG-carved dome) so
// the inner wall seen through an opening reads as "inside" instead of blending
// into the exterior. 1 = no darkening.
const INTERIOR_DARKEN_FACTOR = 0.5;

// Fixed inward contraction (per side, in real-world mm) applied to every
// POLYLINE / STRIP footprint (walls, flat bands, sloped ribbons) when the
// "Réduire le crénelage des parements" setting is on, so a parement drawn
// flush against a wall no longer shares a coplanar face (kills the aliasing
// shimmer). Uniform on lateral faces AND end caps, symmetric about the
// element axis; the geometry stays at true drawn dimensions when the setting
// is off.
const ANTI_ALIASING_SHRINK_MM = 5;

// Never remove more than 85% of a band's half-width so a thin element still
// shrinks partially instead of collapsing / inverting.
const SHRINK_MIN_HALF_WIDTH_RATIO = 0.15;

// Convert the mm setting to pixels for a given baseMap scale (0 when off).
function getAntiAliasingShrinkPx(options, meterByPx) {
  return options?.antiAliasingShrink && meterByPx > 0
    ? ANTI_ALIASING_SHRINK_MM / 1000 / meterByPx
    : 0;
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
  const rawColor = normalizeHex(
    isStrokeDriven
      ? annotation.strokeColor || annotation.fillColor || "#cccccc"
      : annotation.fillColor || annotation.strokeColor || "#cccccc"
  );
  // adjacent mesh cells get a slightly different shade of the parent's color so
  // they're distinguishable in 3D (keyed by label → same label → same color).
  const color = annotation.isMeshCell
    ? shadeMeshCellColor(rawColor, annotation.label)
    : rawColor;
  const rawOpacity = isStrokeDriven
    ? (annotation.strokeOpacity ?? 1)
    : (annotation.fillOpacity ?? 1);
  const opacity = options?.disableOpacity ? 1 : rawOpacity;
  const baseColor = new Color(color);
  // AQUARELLE: flat toon washes (desaturated color + 3-step gradient), no
  // emissive lift and no interior-darken hack — the ink edge lines added by
  // AnnotationsManager's finishing pass carry the 3D form.
  if (options?.aquarelleShading) {
    return createAquarelleMaterial({ color: baseColor, opacity });
  }
  // Realistic render modes (Réaliste / Photoréaliste): true PBR material, no
  // emissive lift and no back-face darkening hack — the environment lighting
  // + shadows convey the 3D form. Same material mapping as the photoreal
  // export, so the live view and the exported image stay consistent.
  if (options?.realisticShading) {
    // PHOTOREAL honors the template's material3d preset (textured PBR);
    // REALISTIC keeps the flat-color PBR material.
    if (options?.photorealShading && annotation.material3d) {
      return createMaterial3dMaterial({
        presetKey: annotation.material3d,
        color: baseColor,
        opacity,
        onMapsLoaded: options?.onAsyncLoaded,
      });
    }
    return createAnnotationPbrMaterial({ color: baseColor, opacity });
  }
  // MeshLambertMaterial (was MeshBasicMaterial): diffuse shading reacts to the
  // scene lights, so a sloped/ramped top face reads as a 3D surface (the mesh
  // already computes smooth vertex normals). Flat annotations stay uniformly
  // lit thanks to the hemisphere light from above.
  const mat = new MeshLambertMaterial({
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

  // Darken back-faces: for a DoubleSide shell, the interior wall seen through an
  // opening is back-facing, so it comes out darker and reveals the cavity. The
  // emissive is already baked into gl_FragColor at this point, so multiplying
  // the final color also dims the emissive lift. Applies to the CSG-carved mesh
  // too (same material reference survives the geometry swap) and to clones
  // (revolution / extruded profile both call material.clone(), which preserves
  // onBeforeCompile + customProgramCacheKey).
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `if ( ! gl_FrontFacing ) { gl_FragColor.rgb *= ${INTERIOR_DARKEN_FACTOR.toFixed(
        3
      )}; }\n#include <dithering_fragment>`
    );
  };
  // Stable cache key so three compiles a program distinct from the unmodified
  // Lambert shader (and shares it across all our annotation materials).
  mat.customProgramCacheKey = () => "annotationInteriorDarken";

  return mat;
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

// Lift the white fold lines just above the surface to avoid z-fighting.
const STRIP_FOLD_LINE_LIFT = 0.004;

// True when a STRIP carries per-point elevation (offsetTop). Only then do we
// take the sloped-nappe path; flat strips (all offsetTop = 0) keep the existing
// polygon-clipping footprint path unchanged.
function stripHasElevation(annotation) {
  return (annotation.points || []).some((p) => (p?.offsetTop ?? 0) !== 0);
}

// Build a sloped single-surface ("nappe sans épaisseur") STRIP from per-point
// offsetTop, as a quad-strip ribbon along the centerline (bypassing polygon-
// clipping so the elevation survives and each station yields a real transverse
// edge → clean horizontal↔slope junctions). Handles closed strips as a wrapping
// loop ribbon. Returns null when no ribbon can be built (caller falls back).
function buildSlopedStripGroup(
  annotation,
  baseMap,
  material,
  verticalLift,
  options
) {
  const ribbons = getSlopedStripRibbons(annotation);
  if (!ribbons.length) return null;

  const distance = getStripDistancePx(annotation, baseMap.meterByPx);
  const shrinkPx = getAntiAliasingShrinkPx(options, baseMap.meterByPx);

  const group = new Group();
  const foldSegments = [];
  // A sloped strip is a SURFACE (no volume): both faces must read with the SAME
  // color, so drop the back-face darkening that makeMaterial bakes in for closed
  // shells (gl_FrontFacing). A distinct cache key forces three to compile this
  // un-darkened program separately from the shared annotation material.
  const surfaceMaterial = material.clone();
  surfaceMaterial.side = DoubleSide;
  surfaceMaterial.onBeforeCompile = () => {};
  surfaceMaterial.customProgramCacheKey = () =>
    "annotationStripSurfaceNoDarken";
  surfaceMaterial.needsUpdate = true;
  ribbons.forEach(({ points, closeLine }) => {
    const built = buildSlopedStripMesh({
      points,
      distance,
      baseMap,
      verticalLift,
      closeLine,
      shrinkPx,
    });
    if (!built) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(built.positions, 3)
    );
    geometry.setIndex(Array.from(built.indices));
    geometry.computeVertexNormals();
    const solidMesh = new Mesh(geometry, surfaceMaterial);
    // Tag the solid so the CSG / subtraction pipeline can locate it.
    solidMesh.userData = { role: "SOLID" };
    group.add(solidMesh);
    if (built.transverseSegments?.length) {
      foldSegments.push(...built.transverseSegments);
    }
  });

  if (group.children.length === 0) return null;

  // White transverse lines marking the horizontal↔slope junctions.
  if (foldSegments.length > 0) {
    const lifted = [];
    for (let i = 0; i < foldSegments.length; i += 3) {
      lifted.push(
        foldSegments[i],
        foldSegments[i + 1],
        foldSegments[i + 2] + STRIP_FOLD_LINE_LIFT
      );
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(lifted, 3));
    group.add(
      new LineSegments(
        g,
        new LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
        })
      )
    );
  }

  return group;
}

// Extrude a CM-width STRIP as a wall: convert the stored band edge to its
// centerline (same offset geometry as the "Basculer ligne ↔ bande" tool:
// centerline = offset(edge, orientation * W/2)) and reuse extrudeWallPolygon,
// so the strip gets the same optional anti-aliasing shrink as CM polylines.
// Arcs are tessellated BEFORE offsetting (the offset output carries no arc
// type), with the same sample count as the 2D footprint so both stay in sync.
function extrudeStripAsWall(
  annotation,
  baseMap,
  height,
  material,
  verticalLift,
  options
) {
  const distance = getStripDistancePx(annotation, baseMap.meterByPx); // signed px
  const { effectiveCloseLine, effectivePoints, chunks } =
    getStripChunks(annotation);

  // Closed ring → closed centerline → hollow ring wall. Mirrors the 2D closed
  // band (which also ignores hiddenSegmentsIdx).
  if (effectiveCloseLine && effectivePoints.length >= 3) {
    const arcPts = expandArcsInPath(effectivePoints, ARC_SAMPLES, true);
    const centerline = offsetPolygon(arcPts, distance / 2);
    if (!centerline || centerline.length < 3) return null;
    return extrudeWallPolygon(
      { ...annotation, points: centerline, closeLine: true },
      baseMap,
      height,
      material,
      verticalLift,
      options
    );
  }

  // Open strip: one wall per visible chunk (split at hiddenSegmentsIdx), like
  // the 2D footprint path.
  const group = new Group();
  chunks.forEach((chunk) => {
    const arcPts = expandArcsInPath(chunk, ARC_SAMPLES, false);
    const centerline = offsetPolyline(arcPts, distance / 2);
    if (!centerline || centerline.length < 2) return;
    const wall = extrudeWallPolygon(
      { ...annotation, points: centerline, closeLine: false },
      baseMap,
      height,
      material,
      verticalLift,
      options
    );
    if (wall) group.add(wall);
  });
  return group.children.length > 0 ? group : null;
}

// Uniformly inset a resolved strip polygon by `shrinkPx` on every edge: outer
// ring inward, holes outward (offsetPolygon is winding-normalized, so the
// signs are absolute), which contracts lateral faces and end caps alike.
// Falls back to the original ring when the inset degenerates (tiny polygon):
// better a coplanar face than a missing volume.
function insetStripPolygon(poly, shrinkPx) {
  const outer = offsetPolygon(poly.points, -shrinkPx);
  const points = outer && outer.length >= 3 ? outer : poly.points;
  const cuts = (poly.cuts || []).map((cut) => {
    if ((cut?.points?.length ?? 0) < 3) return cut;
    const grown = offsetPolygon(cut.points, shrinkPx);
    return grown && grown.length >= 3 ? { ...cut, points: grown } : cut;
  });
  return { ...poly, points, cuts };
}

// Resolve a STRIP annotation into closed polygons and extrude each one.
// Mirrors what NodeStripStatic does in 2D so the 3D matches the visible 2D
// footprint (closeLine, hiddenSegmentsIdx, cuts). CM-width strips with a
// height take the wall path instead (extrudeStripAsWall) so they get the same
// anti-aliasing shrink as CM polylines — except when the strip carries cuts
// (openings), which extrudeWallPolygon can't represent (those go through the
// footprint path, which applies the same shrink via insetStripPolygon).
function extrudeStripPolygons(
  annotation,
  baseMap,
  height,
  material,
  verticalLift,
  options
) {
  // Sloped single-surface strip when points carry offsetTop; otherwise fall
  // through to the flat footprint path (zero behavior change for flat strips).
  if (stripHasElevation(annotation)) {
    const sloped = buildSlopedStripGroup(
      annotation,
      baseMap,
      material,
      verticalLift,
      options
    );
    if (sloped) return sloped;
  }

  const hasRealCuts = (annotation.cuts || []).some(
    (c) => (c?.points?.length ?? 0) >= 3
  );
  if (
    height > 0 &&
    !hasRealCuts &&
    annotation.strokeWidthUnit === "CM" &&
    Number(annotation.strokeWidth) > 0 &&
    baseMap.meterByPx > 0
  ) {
    const wall = extrudeStripAsWall(
      annotation,
      baseMap,
      height,
      material,
      verticalLift,
      options
    );
    if (wall) return wall;
    // null → fall through to the footprint path (safety)
  }

  const polys = getStripePolygons(annotation, baseMap.meterByPx, true);
  if (!polys || polys.length === 0) return null;

  // Same anti-aliasing shrink as the wall path, applied to the resolved
  // footprint: uniform inset on every edge (lateral faces AND end caps),
  // clamped by the band width so a thin band never collapses.
  const shrinkPx = getAntiAliasingShrinkPx(options, baseMap.meterByPx);
  const distancePx = Math.abs(
    getStripDistancePx(annotation, baseMap.meterByPx)
  );
  const effShrink =
    distancePx > 0
      ? Math.min(shrinkPx, distancePx * (0.5 - SHRINK_MIN_HALF_WIDTH_RATIO / 2))
      : shrinkPx;
  const shaped =
    effShrink > 0 ? polys.map((p) => insetStripPolygon(p, effShrink)) : polys;

  const group = new Group();
  shaped.forEach((poly) => {
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

  const strokeWidthCm = annotation.strokeWidth ?? 10;
  const meterByPx = baseMap.meterByPx;
  if (!meterByPx || meterByPx <= 0) return null;
  const thicknessPx = strokeWidthCm / (meterByPx * 100);
  const halfWidth = thicknessPx / 2;

  // Contract the footprint inward so a parement flush against a wall no longer
  // shares a coplanar face (z-fighting / aliasing): pull each side in by
  // `shrinkPx` (half-width reduction, symmetric about the centerline) and, for
  // open polylines, trim the two end caps inward by the same amount. Clamped
  // so a thin wall still shrinks partially but never collapses / inverts.
  const shrinkPx = getAntiAliasingShrinkPx(options, meterByPx);
  const effHalfWidth = Math.max(
    halfWidth - shrinkPx,
    halfWidth * SHRINK_MIN_HALF_WIDTH_RATIO
  );
  const applyShrink = shrinkPx > 0;

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
      // Revolution proxy ("donut"): the POLYGON is only a plan-view marker. In
      // 3D, lathe the linked source arc's revolution instead of extruding the
      // donut. revolutionProxy3D (arc + axis in metres, plan-local centre) is
      // resolved live by useAnnotationsV2, so this also follows the plan point.
      if (
        annotation.isProxy &&
        annotation.revolutionProxy3D?.axisPointsLocal?.length >= 2
      ) {
        const r = annotation.revolutionProxy3D;
        object = buildRevolutionMesh({
          arcPoints: r.arcPointsLocal,
          axisPoints: r.axisPointsLocal,
          centerLocal: r.centerLocal || null,
          orientation: baseMap.orientation,
          material,
          hiddenSegmentsIdx: r.hiddenSegmentsIdx || [],
          // Partial revolution (resolved by useAnnotationsV2).
          ...(r.phiLength != null
            ? { phiStart: r.phiStart ?? 0, phiLength: r.phiLength }
            : {}),
        });
        break;
      }
      const pts = pointsToLocal(annotation.points || [], baseMap);
      const cuts = (annotation.cuts || [])
        .map((cut) => pointsToLocal(cut.points || [], baseMap))
        .filter((c) => c.length >= 3);
      const innerPts = pointsToLocal(annotation.innerPoints || [], baseMap);
      const hasGuideLineRamp = !!annotation.guideLines?.some(
        (g) => g?.points?.length >= 2
      );
      // A ramp/nappe POLYGON is a sloped SURFACE (no volume): both faces must
      // read with the SAME color, so drop the back-face darkening that
      // makeMaterial bakes in for closed shells (gl_FrontFacing). Mirrors
      // buildSlopedStripGroup. A distinct cache key forces three to compile
      // this un-darkened program separately from the shared material.
      let polyMaterial = material;
      if (hasGuideLineRamp && (!height || height <= 0)) {
        polyMaterial = material.clone();
        polyMaterial.side = DoubleSide;
        polyMaterial.onBeforeCompile = () => {};
        polyMaterial.customProgramCacheKey = () =>
          "annotationPolygonSurfaceNoDarken";
        polyMaterial.needsUpdate = true;
      }
      object = extrudeClosedShape(
        pts,
        height,
        polyMaterial,
        cuts,
        verticalLift,
        innerPts,
        {
          isoLines: hasGuideLineRamp,
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
        // Axis-based revolution: revolve the arc around a separate vertical axis
        // (revolutionAxisPoints), placed at the linked plan-view point
        // (revolutionCenterLocal). Both are resolved by useAnnotationsV2. When
        // the axis isn't resolved (missing/deleted), fall through to the default
        // polyline wall so the arc still renders.
        const axisPx = annotation.revolutionAxisPoints || [];
        if (axisPx.length >= 2) {
          const arcPts = pointsToLocal(annotation.points || [], baseMap);
          const axisPts = pointsToLocal(axisPx, baseMap);
          // Partial revolution range, stored on the arc's own shape3D.
          const partialPhi = annotation.shape3D?.partialRevolution
            ? getRevolutionPhi(
                annotation.shape3D.revolutionAngleStart ?? 0,
                annotation.shape3D.revolutionAngleEnd ?? Math.PI * 2
              )
            : {};
          object = buildRevolutionMesh({
            arcPoints: arcPts,
            axisPoints: axisPts,
            centerLocal: annotation.revolutionCenterLocal || null,
            orientation: baseMap.orientation,
            material,
            hiddenSegmentsIdx: annotation.hiddenSegmentsIdx || [],
            ...partialPhi,
          });
          if (object) break;
        }
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
          !!annotation.closeLine,
          // Fired once the async (Dexie liveQuery) profile sweep is built and
          // added to the placeholder — lets AnnotationsManager re-render and
          // re-notify "annotation ready" so post-creation passes (clipping
          // planes, selection dim) reach the freshly-added meshes.
          options?.onAsyncLoaded
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
      // Carry per-vertex offsets onto the sampled arc points (interpolated
      // along the arc) so moving one arc endpoint's offset ramps the whole arc
      // smoothly — not just the sub-segment next to the moved anchor.
      const { points: expanded, hiddenSegmentsIdx: expandedHidden } =
        expandRingWithOffsetsAndHiddenMap(
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
          !!annotation.closeLine,
          // Fired once the async (Dexie liveQuery) profile sweep is built and
          // added to the placeholder — lets AnnotationsManager re-render and
          // re-notify "annotation ready" so post-creation passes (clipping
          // planes, selection dim) reach the freshly-added meshes.
          options?.onAsyncLoaded
        );
        break;
      }
      object = extrudeStripPolygons(
        annotation,
        baseMap,
        height,
        material,
        verticalLift,
        options
      );
      break;
    }
    case "POINT": {
      // Render a POINT that carries a height as a thick vertical line standing
      // up from the basemap plane (base at offsetZ, top at offsetZ + height),
      // using the same screen-space fat-line technique as the 3D drawing trait.
      const p = annotation.point;
      if (!p) break;
      if (height <= 0) break; // no height → nothing in 3D (unchanged behavior)
      const local = pixelToWorld(p, baseMap); // { x, y } in basemap-local meters
      const z0 = verticalLift; // base at offsetZ
      const z1 = verticalLift + height; // top at offsetZ + height
      const geom = new LineGeometry();
      geom.setPositions([local.x, local.y, z0, local.x, local.y, z1]);
      const lineMat = new LineMaterial({
        color: normalizeHex(annotation.fillColor || "#2196f3"),
        linewidth: POINT_TRAIT_LINEWIDTH_PX,
        resolution: options?.resolution, // Vector2 from AnnotationsManager
        worldUnits: false, // screen-space px thickness
        transparent: true,
        // Respect the depth buffer so the trait is occluded by walls / other
        // annotations standing in front of it (no more "always on top").
        depthTest: true,
      });
      const line = new Line2(geom, lineMat);
      line.computeLineDistances();
      // Make the trait hover/click-pickable in 3D (select the POINT) without
      // three's fragile screen-space Line2 raycast — see attachPointTraitRaycast.
      attachPointTraitRaycast(
        line,
        new Vector3(local.x, local.y, z0),
        new Vector3(local.x, local.y, z1)
      );
      object = line;
      break;
    }
    case "OBJECT_3D": {
      // GLB loading is async — return a placeholder Group synchronously and
      // attach the parsed scene when ready. The basemap transform is applied
      // to the placeholder, so the GLB inherits it once added.
      const placeholder = new Group();
      createObject3DAnnotation(annotation, baseMap, options)
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
    annotationTemplateId: annotation.annotationTemplateId,
    vertexRefs,
  };

  return object;
}
