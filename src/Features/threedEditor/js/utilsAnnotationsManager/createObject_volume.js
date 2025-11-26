import {
  Shape,
  ExtrudeGeometry,
  Mesh,
  Group,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  MeshBasicMaterial,
} from "three";

/**
 * Geometric Helper: Calculate Circle Center and Radius from 3 points
 */
function getCircleInfo(p0, p1, p2) {
  const x1 = p0.x,
    y1 = p0.y;
  const x2 = p1.x,
    y2 = p1.y;
  const x3 = p2.x,
    y3 = p2.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-9) return null; // Collinear

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

  // Determine winding (Clockwise vs CCW)
  // Cross product of vectors (P0->P1) and (P0->P2)
  const cp = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  const isClockwise = cp < 0;

  // Angles
  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

  return { center, radius, startAngle, endAngle, isClockwise };
}

export default function createObject_volume(polyline, height, material) {
  // Safety Checks
  const points = polyline?.points;
  const segmentsData = polyline?.segments || [];

  if (!points || points.length < 3) return null;

  const group = new Group();
  const extrudeHeight = height || 1;

  // Create shape with arc approximation
  const shape = new Shape();
  shape.moveTo(points[0].x, points[0].y);

  const numPoints = points.length;
  const isClosed = true; // Assuming shape is always closed
  const limit = isClosed ? numPoints : numPoints - 1;

  for (let i = 0; i < limit; i++) {
    const i0 = i % numPoints;
    const i1 = (i + 1) % numPoints;

    const p0 = points[i0];
    const p1 = points[i1];

    // Check Segment Status
    const segmentMeta = segmentsData[i0] || {};
    const isDeleted = !!segmentMeta.isDeleted;

    // Skip deleted segments
    if (isDeleted) {
      continue;
    }

    // --- CASE 1: ARC (Square -> Circle -> Square) ---
    if (p0.type !== "circle" && p1.type === "circle") {
      // Find the next square point (i+2)
      const i2 = (i + 2) % numPoints;
      const p2 = points[i2];

      const arcInfo = getCircleInfo(p0, p1, p2);

      if (arcInfo) {
        const { center, radius, startAngle, endAngle, isClockwise } = arcInfo;

        // Add arc to shape (perfect curve)
        shape.absarc(center.x, center.y, radius, startAngle, endAngle, isClockwise);

        // Skip the next iteration because we consumed p1 (the circle point)
        i++;
        continue;
      }
    }

    // --- CASE 2: STRAIGHT LINE ---
    shape.lineTo(p1.x, p1.y);
  }

  // Close the shape
  shape.closePath();

  // Create extruded geometry
  const extrudeSettings = {
    depth: extrudeHeight,
    bevelEnabled: false,
  };

  const extrudeGeometry = new ExtrudeGeometry(shape, extrudeSettings);
  const extrudeMesh = new Mesh(extrudeGeometry, material);
  group.add(extrudeMesh);

  // Add edges
  const edgesMaterial = new LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
  });

  const edgesGeometry = new EdgesGeometry(extrudeGeometry);
  const edges = new LineSegments(edgesGeometry, edgesMaterial);
  group.add(edges);

  return group;
}

