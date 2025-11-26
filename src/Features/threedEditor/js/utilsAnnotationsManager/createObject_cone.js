import {
  Shape,
  ShapeGeometry,
  Mesh,
  Group,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  // DoubleSide, // REMOVED: No longer needed for walls
  FrontSide, // ADDED: For outside wall
  BackSide, // ADDED: For inside wall
  Color, // ADDED: To manipulate color for the inside
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
} from "three";

// ... [KEEP getCircleInfo FUNCTION AS IS] ...
function getCircleInfo(p0, p1, p2) {
  // ... (same content as before)
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
  const cp = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
  const isClockwise = cp < 0;

  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);

  return { center, radius, startAngle, endAngle, isClockwise };
}

// ... [KEEP buildShapeFromPoints FUNCTION AS IS] ...
function buildShapeFromPoints(points, segmentsData = []) {
  // ... (same content as before)
  const shape = new Shape();
  if (points.length === 0) return shape;

  shape.moveTo(points[0].x, points[0].y);

  const numPoints = points.length;
  const isClosed = true;
  const limit = isClosed ? numPoints : numPoints - 1;

  for (let i = 0; i < limit; i++) {
    const i0 = i % numPoints;
    const i1 = (i + 1) % numPoints;

    const p0 = points[i0];
    const p1 = points[i1];

    // Check Segment Status
    const segmentMeta = segmentsData[i0] || {};
    const isDeleted = !!segmentMeta.isDeleted;

    if (isDeleted) continue;

    // --- CASE 1: ARC ---
    if (p0.type !== "circle" && p1.type === "circle") {
      const i2 = (i + 2) % numPoints;
      const p2 = points[i2];
      const arcInfo = getCircleInfo(p0, p1, p2);

      if (arcInfo) {
        const { center, radius, startAngle, endAngle, isClockwise } = arcInfo;
        shape.absarc(
          center.x,
          center.y,
          radius,
          startAngle,
          endAngle,
          isClockwise
        );
        i++;
        continue;
      }
    }

    // --- CASE 2: LINE ---
    shape.lineTo(p1.x, p1.y);
  }

  shape.closePath();
  return shape;
}

// ... [KEEP sampleShapePoints FUNCTION AS IS] ...
function sampleShapePoints(shape, numSamples = 64) {
  // ... (same content as before)
  const points = [];
  const spacedPoints = shape.getSpacedPoints(numSamples);
  for (let i = 0; i < spacedPoints.length; i++) {
    points.push({ x: spacedPoints[i].x, y: spacedPoints[i].y });
  }
  return points;
}

export default function createObject_cone(polyline, height, material) {
  // 1. Safety Checks
  const points = polyline?.points;
  const cuts = polyline?.cuts || [];
  const segmentsData = polyline?.segments || [];

  if (!points || points.length < 3) return null;

  // Get the first cut for the bottom circle
  const firstCut = cuts[0];
  if (!firstCut || !firstCut.points || firstCut.points.length < 3) {
    return null;
  }

  const group = new Group();
  const coneHeight = height || 1;

  // 2. Build Shapes
  const topShape = buildShapeFromPoints(points, segmentsData);
  const bottomShape = buildShapeFromPoints(
    firstCut.points,
    firstCut.segments || []
  );

  // 3. Build Side Walls (Ribbon) Geometry
  const numSamples = 64;
  const topSampled = sampleShapePoints(topShape, numSamples);
  const bottomSampled = sampleShapePoints(bottomShape, numSamples);

  const vertices = [];
  const numPoints = Math.min(topSampled.length, bottomSampled.length);

  for (let i = 0; i < numPoints; i++) {
    const nextI = (i + 1) % numPoints;
    const topP0 = topSampled[i];
    const topP1 = topSampled[nextI];
    const bottomP0 = bottomSampled[i];
    const bottomP1 = bottomSampled[nextI];

    // Triangle 1
    vertices.push(topP0.x, topP0.y, coneHeight);
    vertices.push(bottomP0.x, bottomP0.y, 0);
    vertices.push(topP1.x, topP1.y, coneHeight);

    // Triangle 2
    vertices.push(bottomP0.x, bottomP0.y, 0);
    vertices.push(bottomP1.x, bottomP1.y, 0);
    vertices.push(topP1.x, topP1.y, coneHeight);
  }

  const coneWallGeometry = new BufferGeometry();
  coneWallGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(vertices, 3)
  );
  coneWallGeometry.computeVertexNormals();

  // --- DIFFERENCIATE INTRADO/EXTRADO ---

  const isTransparent = material.transparent && material.opacity < 1;

  // 1. Outside Material (Extrado) - FrontSide
  const outsideMaterial = new MeshBasicMaterial({
    color: material.color,
    transparent: material.transparent,
    opacity: material.opacity,
    side: FrontSide, // Only render the outside face
    depthWrite: !isTransparent, // Write depth only if opaque
    depthTest: true,
  });

  // 2. Inside Material (Intrado) - BackSide
  // Create a darker version of the color for the inside to create visual depth
  const insideColor = new Color(material.color).multiplyScalar(0.6);

  const insideMaterial = new MeshBasicMaterial({
    color: insideColor, // Use the darker color
    transparent: material.transparent,
    opacity: material.opacity ? Math.min(1, material.opacity * 1.2) : 1,
    side: BackSide, // Only render the inside face
    depthWrite: false, // Never write depth for inside (always behind outside)
    depthTest: true,
  });

  // Create two separate meshes using the same geometry but different materials
  const insideWallMesh = new Mesh(coneWallGeometry, insideMaterial);
  const outsideWallMesh = new Mesh(coneWallGeometry, outsideMaterial);

  // Set render order for proper transparency: inside first, then outside
  if (isTransparent) {
    insideWallMesh.renderOrder = 0;
    outsideWallMesh.renderOrder = 1;
  }

  group.add(insideWallMesh);
  group.add(outsideWallMesh);

  // 4. Build Caps & Edges (Outlines)

  const edgesMaterial = new LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.6,
  });

  // We use outsideMaterial for caps so they match the exterior wall
  const capMaterial = new MeshBasicMaterial({
    color: material.color,
    transparent: material.transparent,
    opacity: material.opacity,
    side: FrontSide, // Only render top face
    depthWrite: !isTransparent, // Write depth only if opaque
    depthTest: true,
  });

  // --- TOP CAP ---
  const topGeometry = new ShapeGeometry(topShape);
  const topMesh = new Mesh(topGeometry, capMaterial);
  topMesh.position.z = coneHeight;
  group.add(topMesh);

  // Top Edges
  const topEdgesGeo = new EdgesGeometry(topGeometry);
  const topEdges = new LineSegments(topEdgesGeo, edgesMaterial);
  topEdges.position.z = coneHeight;
  group.add(topEdges);

  // --- BOTTOM CAP ---
  const bottomGeometry = new ShapeGeometry(bottomShape);
  const bottomMesh = new Mesh(bottomGeometry, capMaterial);
  bottomMesh.position.z = 0.02;
  group.add(bottomMesh);

  // Bottom Edges
  const bottomEdgesGeo = new EdgesGeometry(bottomGeometry);
  const bottomEdges = new LineSegments(bottomEdgesGeo, edgesMaterial);
  bottomEdges.position.z = 0.02;
  group.add(bottomEdges);

  return group;
}
