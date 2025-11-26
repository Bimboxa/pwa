import {
  Shape,
  ShapeGeometry,
  Mesh,
  Group,
  BufferGeometry,
  Float32BufferAttribute,
  Vector2,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  MeshBasicMaterial,
  DoubleSide,
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

  const cp = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  const isClockwise = cp < 0;

  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const midAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
  const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

  return { center, radius, startAngle, midAngle, endAngle, isClockwise };
}

/**
 * Helper to push wall vertices for an arc segment
 */
function addArcWallVertices(
  verticesArray,
  center,
  radius,
  angleStart,
  angleEnd,
  isClockwise,
  wallHeight,
  subdivisions = 6
) {
  let totalAngle = angleEnd - angleStart;
  const TWO_PI = Math.PI * 2;

  // Normalize angle delta based on winding
  if (isClockwise && totalAngle > 0) totalAngle -= TWO_PI;
  if (!isClockwise && totalAngle < 0) totalAngle += TWO_PI;

  for (let s = 0; s < subdivisions; s++) {
    const t1 = s / subdivisions;
    const t2 = (s + 1) / subdivisions;

    const ang1 = angleStart + totalAngle * t1;
    const ang2 = angleStart + totalAngle * t2;

    const wx1 = center.x + radius * Math.cos(ang1);
    const wy1 = center.y + radius * Math.sin(ang1);
    const wx2 = center.x + radius * Math.cos(ang2);
    const wy2 = center.y + radius * Math.sin(ang2);

    // Add Quad
    // Triangle 1
    verticesArray.push(wx1, wy1, 0);
    verticesArray.push(wx2, wy2, 0);
    verticesArray.push(wx1, wy1, wallHeight);
    // Triangle 2
    verticesArray.push(wx2, wy2, 0);
    verticesArray.push(wx2, wy2, wallHeight);
    verticesArray.push(wx1, wy1, wallHeight);
  }
}

export default function createObject_floorAndWalls(polyline, height, material) {
  // 1. Safety Checks
  const points = polyline?.points;
  const segmentsData = polyline?.segments || [];

  if (!points || points.length < 3) return null;

  const group = new Group();
  const wallHeight = height || 1;

  const fillMaterial = new MeshBasicMaterial({
    color: material.color,
    transparent: material.transparent,
    opacity: material.opacity,
    side: DoubleSide,
    depthWrite: false,
  });

  // --- PREPARE GEOMETRY DATA ---

  const floorShape = new Shape();
  floorShape.moveTo(points[0].x, points[0].y);

  const wallVertices = []; // Straight edges
  const wallVerticesAll = []; // Mesh (straight + curved)
  const numPoints = points.length;
  const isClosed = true;
  const limit = isClosed ? numPoints : numPoints - 1;

  for (let i = 0; i < limit; i++) {
    const i0 = i % numPoints;
    const i1 = (i + 1) % numPoints;

    const p0 = points[i0];
    const p1 = points[i1];

    // Segment 1 Status (P0 -> P1)
    const segmentMeta1 = segmentsData[i0] || {};
    const isDeleted1 = !!segmentMeta1.isDeleted;

    // --- CASE 1: ARC (Square -> Circle -> Square) ---
    if (p0.type !== "circle" && p1.type === "circle") {
      const i2 = (i + 2) % numPoints;
      const p2 = points[i2];

      // Segment 2 Status (P1 -> P2)
      const segmentMeta2 = segmentsData[i1] || {};
      const isDeleted2 = !!segmentMeta2.isDeleted;

      const arcInfo = getCircleInfo(p0, p1, p2);

      if (arcInfo) {
        const { center, radius, startAngle, midAngle, endAngle, isClockwise } =
          arcInfo;

        // A. Floor Shape: Always draw the full curve to maintain room shape
        // (Unless you specifically want the floor to be straight if walls are deleted,
        // but usually floor footprint is constant).
        floorShape.absarc(
          center.x,
          center.y,
          radius,
          startAngle,
          endAngle,
          isClockwise
        );

        // B. Wall Mesh - SPLIT INTO TWO PARTS

        // Part 1: P0 -> P1 (The first half of the arc)
        if (!isDeleted1) {
          addArcWallVertices(
            wallVerticesAll,
            center,
            radius,
            startAngle,
            midAngle,
            isClockwise,
            wallHeight,
            6
          );
        }

        // Part 2: P1 -> P2 (The second half of the arc)
        if (!isDeleted2) {
          addArcWallVertices(
            wallVerticesAll,
            center,
            radius,
            midAngle,
            endAngle,
            isClockwise,
            wallHeight,
            6
          );
        }

        // IMPORTANT: Skip the circle point (i1) as we processed P0->P1->P2
        i++;
        continue;
      }
    }

    // --- CASE 2: STRAIGHT LINE ---

    floorShape.lineTo(p1.x, p1.y);

    if (!isDeleted1) {
      // Triangle 1
      wallVertices.push(p0.x, p0.y, 0);
      wallVertices.push(p1.x, p1.y, 0);
      wallVertices.push(p0.x, p0.y, wallHeight);

      // Triangle 2
      wallVertices.push(p1.x, p1.y, 0);
      wallVertices.push(p1.x, p1.y, wallHeight);
      wallVertices.push(p0.x, p0.y, wallHeight);

      // Add to mesh array
      wallVerticesAll.push(p0.x, p0.y, 0);
      wallVerticesAll.push(p1.x, p1.y, 0);
      wallVerticesAll.push(p0.x, p0.y, wallHeight);
      wallVerticesAll.push(p1.x, p1.y, 0);
      wallVerticesAll.push(p1.x, p1.y, wallHeight);
      wallVerticesAll.push(p0.x, p0.y, wallHeight);
    }
  }

  // --- BUILD MESHES ---

  // 1. Floor
  const floorGeometry = new ShapeGeometry(floorShape);
  const floorMesh = new Mesh(floorGeometry, fillMaterial);
  floorMesh.position.z = 0.02;
  group.add(floorMesh);

  // 2. Walls
  if (wallVerticesAll.length > 0) {
    const wallGeometryAll = new BufferGeometry();
    wallGeometryAll.setAttribute(
      "position",
      new Float32BufferAttribute(wallVerticesAll, 3)
    );
    wallGeometryAll.computeVertexNormals();

    const wallsMesh = new Mesh(wallGeometryAll, fillMaterial);
    group.add(wallsMesh);

    // 3. Wall Edges (Straight only)
    if (wallVertices.length > 0) {
      const wallGeometry = new BufferGeometry();
      wallGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(wallVertices, 3)
      );

      const edgesMaterial = new LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
      });

      const wallEdgesGeo = new EdgesGeometry(wallGeometry);
      const wallEdges = new LineSegments(wallEdgesGeo, edgesMaterial);
      group.add(wallEdges);
    }
  }

  // 4. Floor Edges
  const edgesMaterial = new LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
  });
  const floorEdgesGeo = new EdgesGeometry(floorGeometry);
  const floorEdges = new LineSegments(floorEdgesGeo, edgesMaterial);
  floorEdges.position.z = 0.02;
  group.add(floorEdges);

  return group;
}
