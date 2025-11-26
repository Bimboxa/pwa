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

  // Determine winding (Clockwise vs CCW)
  // Cross product of vectors (P0->P1) and (P0->P2)
  const cp = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  const isClockwise = cp < 0; // Standard math (Y-up in 3D usually, but assuming 2D plane logic)

  // Angles
  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

  return { center, radius, startAngle, endAngle, isClockwise };
}

export default function createObject_floorAndWalls(
  polyline, // CHANGED: Expects the full polyline object { points: [], segments: [] }
  height,
  material
) {
  // 1. Safety Checks
  const points = polyline?.points;
  const segmentsData = polyline?.segments || [];

  if (!points || points.length < 3) return null;

  const group = new Group();
  const wallHeight = height || 1;

  // Material setup
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

  const wallVertices = []; // Stores x,y,z for wall triangles (straight segments only, for edges)
  const wallVerticesAll = []; // Stores all wall triangles (including arcs, no edges)
  const numPoints = points.length;
  const isClosed = true; // Assuming floor is always closed

  // We iterate through points. Note: The logic handles wrapping for closed shapes manually/implicitly via the loop limit.
  // Assuming mapped indices: Segments[i] corresponds to the wall starting at Points[i]

  const limit = isClosed ? numPoints : numPoints - 1;

  for (let i = 0; i < limit; i++) {
    const i0 = i % numPoints;
    const i1 = (i + 1) % numPoints;

    const p0 = points[i0];
    const p1 = points[i1];

    // Check Segment Status
    const segmentMeta = segmentsData[i0] || {};
    const isDeleted = !!segmentMeta.isDeleted;

    // --- CASE 1: ARC (Square -> Circle -> Square) ---
    // We check if the NEXT point is a circle control point
    if (p0.type !== "circle" && p1.type === "circle") {
      // Find the next square point (i+2)
      const i2 = (i + 2) % numPoints;
      const p2 = points[i2];

      const arcInfo = getCircleInfo(p0, p1, p2);

      if (arcInfo) {
        const { center, radius, startAngle, endAngle, isClockwise } = arcInfo;

        // A. Add to Floor Shape (Perfect Curve)
        floorShape.absarc(
          center.x,
          center.y,
          radius,
          startAngle,
          endAngle,
          isClockwise
        );

        // B. Add to Wall Mesh (Approximate with 12 segments)
        // Note: Arc segments are added to wallVerticesAll but NOT to wallVertices
        // This way edges will not be drawn for approximated arc segments
        if (!isDeleted) {
          const SUBDIVISIONS = 12;

          let totalAngle = endAngle - startAngle;
          // Adjust angle based on winding to ensure we draw the short arc or long arc correctly
          const TWO_PI = Math.PI * 2;
          if (isClockwise && totalAngle > 0) totalAngle -= TWO_PI;
          if (!isClockwise && totalAngle < 0) totalAngle += TWO_PI;

          for (let s = 0; s < SUBDIVISIONS; s++) {
            const t1 = s / SUBDIVISIONS;
            const t2 = (s + 1) / SUBDIVISIONS;

            const ang1 = startAngle + totalAngle * t1;
            const ang2 = startAngle + totalAngle * t2;

            const wx1 = center.x + radius * Math.cos(ang1);
            const wy1 = center.y + radius * Math.sin(ang1);
            const wx2 = center.x + radius * Math.cos(ang2);
            const wy2 = center.y + radius * Math.sin(ang2);

            // Add Quad (2 Triangles) for this small segment
            // Add to wallVerticesAll (for rendering) but NOT to wallVertices (for edges)
            // Tri 1
            wallVerticesAll.push(wx1, wy1, 0);
            wallVerticesAll.push(wx2, wy2, 0);
            wallVerticesAll.push(wx1, wy1, wallHeight);
            // Tri 2
            wallVerticesAll.push(wx2, wy2, 0);
            wallVerticesAll.push(wx2, wy2, wallHeight);
            wallVerticesAll.push(wx1, wy1, wallHeight);
          }
        }

        // Skip the next iteration because we consumed p1 (the circle point)
        i++;
        continue;
      }
    }

    // --- CASE 2: STRAIGHT LINE ---

    // A. Add to Floor Shape
    floorShape.lineTo(p1.x, p1.y);

    // B. Add to Wall Mesh
    if (!isDeleted) {
      // Triangle 1
      wallVertices.push(p0.x, p0.y, 0);
      wallVertices.push(p1.x, p1.y, 0);
      wallVertices.push(p0.x, p0.y, wallHeight);

      // Triangle 2
      wallVertices.push(p1.x, p1.y, 0);
      wallVertices.push(p1.x, p1.y, wallHeight);
      wallVertices.push(p0.x, p0.y, wallHeight);

      // Also add to wallVerticesAll for rendering
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
  floorMesh.position.z = 0.02; // Z-fight fix
  group.add(floorMesh);

  // 2. Walls - Render all walls (straight + arcs)
  if (wallVerticesAll.length > 0) {
    const wallGeometryAll = new BufferGeometry();
    wallGeometryAll.setAttribute(
      "position",
      new Float32BufferAttribute(wallVerticesAll, 3)
    );
    wallGeometryAll.computeVertexNormals();

    const wallsMesh = new Mesh(wallGeometryAll, fillMaterial);
    group.add(wallsMesh);

    // 3. Wall Edges (Outlines) - Only for straight segments, not arcs
    // Use wallVertices (straight segments only) for edges
    if (wallVertices.length > 0) {
      const wallGeometry = new BufferGeometry();
      wallGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(wallVertices, 3)
      );
      wallGeometry.computeVertexNormals();

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
  // Note: Floor edges will outline the continuous floor, ignoring wall holes, which is usually desired.
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
