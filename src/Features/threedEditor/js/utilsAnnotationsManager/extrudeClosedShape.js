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
} from "three";

import triangulateAnnotationGeometry from "Features/geometry/utils/triangulateAnnotationGeometry";
import {
  typeOf,
  circleFromThreePoints,
  sampleArcPoints,
} from "Features/geometry/utils/arcSampling";

// Match the codebase convention used by other arc-aware paths.
const ARC_SAMPLES = 6;

const lerp = (a, b, t) => a + (b - a) * t;

// The fast Shape path curves S-C-S arcs via path.absarc. The per-vertex-Z
// path triangulates the contour directly, so arcs must be expanded into
// straight samples here too — otherwise a curved face/ramp collapses into
// the chord polygon of its control points. Anchor points keep their offsets;
// sampled points get offsetTop / offsetBottom interpolated along the arc so
// the curved top follows the ramp. Geometry matches expandArcsInPath; only
// the offset carrying is added.
function expandRingWithOffsets(ring, samples, closeLine) {
  const n = (ring || []).length;
  if (n < 3) return (ring || []).map((p) => ({ ...p }));
  const get = closeLine
    ? (k) => ring[((k % n) + n) % n]
    : (k) => ring[k];
  const out = [];
  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);
    const isArc =
      p1 &&
      p2 &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";
    if (isArc) {
      const circ = circleFromThreePoints(p0, p1, p2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const isCW = cross > 0;
        const t0 = p0.offsetTop ?? 0;
        const b0 = p0.offsetBottom ?? 0;
        const t1 = p1.offsetTop ?? 0;
        const b1 = p1.offsetBottom ?? 0;
        const t2 = p2.offsetTop ?? 0;
        const b2 = p2.offsetBottom ?? 0;
        out.push({ ...p0 });
        const arc01 = sampleArcPoints(p0, p1, circ.center, circ.r, isCW, samples);
        arc01.forEach((s, k) => {
          const f = (k + 1) / samples;
          out.push({
            x: s.x,
            y: s.y,
            offsetTop: lerp(t0, t1, f),
            offsetBottom: lerp(b0, b1, f),
          });
        });
        const arc12 = sampleArcPoints(p1, p2, circ.center, circ.r, isCW, samples);
        for (let k = 0; k < arc12.length - 1; k++) {
          const f = (k + 1) / samples;
          out.push({
            x: arc12[k].x,
            y: arc12[k].y,
            offsetTop: lerp(t1, t2, f),
            offsetBottom: lerp(b1, b2, f),
          });
        }
        i += 2;
        consumed += 2;
        continue;
      }
    }
    out.push({ ...p0 });
    i += 1;
    consumed += 1;
  }
  return out;
}

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
    (ring || []).some((p) => (p?.offsetBottom ?? 0) !== 0 || (p?.offsetTop ?? 0) !== 0);
  return ringHas(points) || (holes || []).some(ringHas) || ringHas(innerPoints);
}

export default function extrudeClosedShape(points, height, material, holes, verticalLift = 0, innerPoints = []) {
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

  let geometry;
  if (!hasPerVertexZ(points, holes, innerPoints) && !hasInnerPoints) {
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
    const tri = triangulateAnnotationGeometry({
      contour: expandRingWithOffsets(points, ARC_SAMPLES, true),
      holes: (holes || []).map((h) =>
        expandRingWithOffsets(h, ARC_SAMPLES, true)
      ),
      innerPoints,
      height: isExtruded ? height : 0,
      verticalLift,
      zFightOffset: Z_FIGHT_OFFSET,
    });
    geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(tri.positions, 3));
    geometry.setIndex(Array.from(tri.indices));
    geometry.computeVertexNormals();
  }

  // DoubleSide for both flat and extruded paths: pixelToWorld inverts Y which
  // flips winding, and polygons-with-holes can produce inconsistent normals
  // (especially in the per-vertex-Z path), leaving some faces invisible from
  // the user's viewpoint. DoubleSide trades a bit of depth stability during
  // rotation for predictable visibility from any angle.
  material.side = DoubleSide;
  group.add(new Mesh(geometry, material));

  const edges = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
  );
  group.add(edges);

  return group;
}
