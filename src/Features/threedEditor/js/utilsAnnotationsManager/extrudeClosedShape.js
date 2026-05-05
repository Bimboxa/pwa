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
      contour: points,
      holes,
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
