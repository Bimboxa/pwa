import {
  Shape,
  Path,
  ShapeGeometry,
  ExtrudeGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Group,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  DoubleSide,
  FrontSide,
  ShapeUtils,
  Vector2,
} from "three";

import triangulateAnnotationGeometry, {
  ISO_BAND_LEVELS,
} from "Features/geometry/utils/triangulateAnnotationGeometry";
import { expandRingWithOffsets } from "Features/geometry/utils/arcSampling";

// Match the codebase convention used by other arc-aware paths.
const ARC_SAMPLES = 6;

function getCircleInfo(p0, p1, p2) {
  const x1 = p0.x;
  const y1 = p0.y;
  const x2 = p1.x;
  const y2 = p1.y;
  const x3 = p2.x;
  const y3 = p2.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-9) return null;

  const Ux =
    (1 / D) *
    ((x1 ** 2 + y1 ** 2) * (y2 - y3) +
      (x2 ** 2 + y2 ** 2) * (y3 - y1) +
      (x3 ** 2 + y3 ** 2) * (y1 - y2));
  const Uy =
    (1 / D) *
    ((x1 ** 2 + y1 ** 2) * (x3 - x2) +
      (x2 ** 2 + y2 ** 2) * (x1 - x3) +
      (x3 ** 2 + y3 ** 2) * (x2 - x1));

  const center = { x: Ux, y: Uy };
  const radius = Math.hypot(x1 - Ux, y1 - Uy);
  const cp = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  const isClockwise = cp < 0;
  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
  return { center, radius, startAngle, endAngle, isClockwise };
}

function tracePath(path, points) {
  path.moveTo(points[0].x, points[0].y);
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const i0 = i % n;
    const i1 = (i + 1) % n;
    const p0 = points[i0];
    const p1 = points[i1];
    if (p0.type !== "circle" && p1.type === "circle") {
      const i2 = (i + 2) % n;
      const p2 = points[i2];
      const arc = getCircleInfo(p0, p1, p2);
      if (arc) {
        path.absarc(
          arc.center.x,
          arc.center.y,
          arc.radius,
          arc.startAngle,
          arc.endAngle,
          arc.isClockwise
        );
        i++;
        continue;
      }
    }
    path.lineTo(p1.x, p1.y);
  }
  path.closePath();
}

// Lift closed surfaces slightly above the basemap plane to avoid z-fighting.
const Z_FIGHT_OFFSET = 0.001;

function hasPerVertexZ(points, holes, innerPoints) {
  const ringHas = (ring) =>
    (ring || []).some(
      (p) => (p?.offsetBottom ?? 0) !== 0 || (p?.offsetTop ?? 0) !== 0
    );
  return ringHas(points) || (holes || []).some(ringHas) || ringHas(innerPoints);
}

// ~12 "virtual" iso-height contour lines on the top surface (transverse to
// the slope / guideLine). Pure visualization — not stored on the annotation.
// The top surface is the (arc-expanded) contour minus holes, triangulated and
// sliced at evenly-spaced height levels (same count as the mesh banding).
const ISO_LEVELS = ISO_BAND_LEVELS;

function buildIsoHeightLines(expContour, expHoles, topZOf) {
  if (!expContour || expContour.length < 3) return null;
  const contourV2 = expContour.map((p) => new Vector2(p.x, p.y));
  const holesV2 = (expHoles || [])
    .filter((h) => h && h.length >= 3)
    .map((h) => h.map((p) => new Vector2(p.x, p.y)));
  let faces;
  try {
    faces = ShapeUtils.triangulateShape(contourV2, holesV2) || [];
  } catch (e) {
    return null;
  }
  if (faces.length === 0) return null;
  const flat = [
    expContour,
    ...(expHoles || []).filter((h) => h && h.length >= 3),
  ].flat();
  const z = flat.map(topZOf);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const v of z) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
  }
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax) || zMax - zMin < 1e-4) {
    return null;
  }
  const positions = [];
  const LIFT = 0.004; // sit just above the surface to avoid z-fighting
  for (let li = 1; li <= ISO_LEVELS; li++) {
    const level = zMin + ((zMax - zMin) * li) / (ISO_LEVELS + 1);
    // Collect every triangle-edge crossing at this height, then emit ONE
    // straight segment per level (the farthest-apart pair). On a ramp an
    // iso contour is a straight line transverse to the slope, so this keeps
    // it a clean segment instead of a triangle-by-triangle jagged polyline.
    const hits = [];
    for (const f of faces) {
      const tri = [flat[f[0]], flat[f[1]], flat[f[2]]];
      const tz = [z[f[0]], z[f[1]], z[f[2]]];
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const da = tz[e] - level;
        const db = tz[(e + 1) % 3] - level;
        if ((da < 0 && db < 0) || (da > 0 && db > 0)) continue;
        if (da === 0 && db === 0) continue;
        const t = da / (da - db);
        if (!Number.isFinite(t)) continue;
        hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (hits.length < 2) continue;
    let p0 = hits[0];
    let p1 = hits[1];
    let best = -1;
    for (let i = 0; i < hits.length; i++) {
      for (let j = i + 1; j < hits.length; j++) {
        const d = (hits[i].x - hits[j].x) ** 2 + (hits[i].y - hits[j].y) ** 2;
        if (d > best) {
          best = d;
          p0 = hits[i];
          p1 = hits[j];
        }
      }
    }
    positions.push(p0.x, p0.y, level + LIFT, p1.x, p1.y, level + LIFT);
  }
  if (positions.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return new LineSegments(
    g,
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  );
}

// White iso lines built from the mesh's own iso-band segments
// ([ax,ay,az, bx,by,bz, ...] in local space). Lifted slightly above the
// surface to avoid z-fighting. These are the band boundaries themselves, so
// the lines stay regular and aligned along the whole ramp.
function buildIsoLinesFromSegments(segments) {
  if (!segments || segments.length === 0) return null;
  const LIFT = 0.004;
  const positions = [];
  for (const s of segments) {
    positions.push(s[0], s[1], s[2] + LIFT, s[3], s[4], s[5] + LIFT);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return new LineSegments(
    g,
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  );
}

export default function extrudeClosedShape(
  points,
  height,
  material,
  holes,
  verticalLift = 0,
  innerPoints = [],
  options = {}
) {
  if (!points || points.length < 3) return null;

  const isExtruded = height && height > 0;
  const group = new Group();

  // Fast path: no per-vertex offsets. Use the original Shape + ShapeGeometry /
  // ExtrudeGeometry construction (zero behavior change for existing data).
  // Per-vertex-Z path uses the shared triangulation utility — same util used by
  // getAnnotationQties, so visuals and quantities stay consistent.
  // The presence of innerPoints (Steiner points) forces the per-vertex-Z path
  // even if no offsets are set yet — otherwise the fast Shape/ExtrudeGeometry
  // path would silently drop them, which is confusing during authoring.
  const hasInnerPoints = Array.isArray(innerPoints) && innerPoints.length > 0;
  const isPerVertexZPath =
    hasPerVertexZ(points, holes, innerPoints) || hasInnerPoints;

  let geometry;
  if (!isPerVertexZPath) {
    const shape = new Shape();
    tracePath(shape, points);
    if (holes && holes.length) {
      holes.forEach((holePoints) => {
        if (!holePoints || holePoints.length < 3) return;
        const hole = new Path();
        tracePath(hole, [...holePoints].reverse());
        shape.holes.push(hole);
      });
    }
    geometry = isExtruded
      ? new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      : new ShapeGeometry(shape);
    geometry.translate(0, 0, verticalLift + Z_FIGHT_OFFSET);
  } else {
    const expContour = expandRingWithOffsets(points, ARC_SAMPLES, true);
    const expHoles = (holes || []).map((h) =>
      expandRingWithOffsets(h, ARC_SAMPLES, true)
    );
    const tri = triangulateAnnotationGeometry({
      contour: expContour,
      holes: expHoles,
      innerPoints,
      height: isExtruded ? height : 0,
      verticalLift,
      zFightOffset: Z_FIGHT_OFFSET,
      isoBandLevels: options.isoLines ? ISO_LEVELS : 0,
    });
    geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(tri.positions, 3)
    );
    geometry.setIndex(Array.from(tri.indices));
    geometry.computeVertexNormals();

    if (options.isoLines) {
      // Prefer the mesh's own iso-band segments (regular, surface-aligned).
      // Fall back to the standalone retriangulation when banding didn't apply
      // (holes, Steiner points, non-monotone rails).
      let isoLines = buildIsoLinesFromSegments(tri.isoSegments);
      if (!isoLines) {
        const h = isExtruded ? height : 0;
        isoLines = buildIsoHeightLines(
          expContour,
          expHoles,
          (p) =>
            verticalLift +
            h +
            (p.offsetBottom ?? 0) +
            (p.offsetTop ?? 0) +
            Z_FIGHT_OFFSET
        );
      }
      if (isoLines) group.add(isoLines);
    }
  }

  // DoubleSide for both flat and extruded paths: pixelToWorld inverts Y which
  // flips winding, and polygons-with-holes can produce inconsistent normals
  // (especially in the per-vertex-Z path), leaving some faces invisible from
  // the user's viewpoint. DoubleSide trades a bit of depth stability during
  // rotation for predictable visibility from any angle.
  material.side = DoubleSide;
  const solidMesh = new Mesh(geometry, material);
  // Tag the fill mesh so the CSG / subtraction pipeline can locate the solid
  // geometry inside the returned Group (which also holds edges / iso lines).
  solidMesh.userData = { ...(solidMesh.userData ?? {}), role: "SOLID" };
  group.add(solidMesh);

  // Black outline only on the flat fast path, where the mesh is planar and
  // EdgesGeometry yields a clean stroke-like border. On the per-vertex-Z path
  // (ramps / sloped surfaces) EdgesGeometry would emit nearly every internal
  // triangulation diagonal (1° default threshold) — a noisy black web. There,
  // the lit shading provides the silhouette and the white iso lines structure
  // the surface, so the edges are dropped.
  if (!isPerVertexZPath) {
    const edges = new LineSegments(
      new EdgesGeometry(geometry),
      new LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
      })
    );
    group.add(edges);
  }

  return group;
}
