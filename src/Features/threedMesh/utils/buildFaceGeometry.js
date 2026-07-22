import {
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import { lighten } from "@mui/material/styles";

import computePlaneBasis from "./computePlaneBasis.js";
import { projectLoopTo2d } from "./planeProjection.js";
import { MESH3D_LIFT_M } from "./mesh3dConstants.js";

function safeLighten(color, amount, fallback) {
  try {
    return lighten(color, amount);
  } catch {
    return fallback;
  }
}

// Builds the THREE.Mesh of one maille face: the planar loop as a flat,
// double-sided surface (no thickness), triangulated in the (u, v) plane basis
// and placed in world space via a basis matrix. Polygon offset + a 1 mm lift
// along the normal keep it off the source face it was created from.
export default function buildFaceGeometry(
  face,
  { color, edgeColor, selected, dimmed } = {}
) {
  const contour = face?.contour;
  if (!contour || contour.length < 3) return null;

  const basis = computePlaneBasis(face.normal, contour[0]);

  const shape = new Shape();
  const contour2d = projectLoopTo2d(contour, basis);
  shape.moveTo(contour2d[0].x, contour2d[0].y);
  for (let i = 1; i < contour2d.length; i++) {
    shape.lineTo(contour2d[i].x, contour2d[i].y);
  }
  shape.closePath();

  for (const hole of face.holes || []) {
    const hole2d = projectLoopTo2d(hole, basis);
    if (hole2d.length < 3) continue;
    const path = new Path();
    path.moveTo(hole2d[0].x, hole2d[0].y);
    for (let i = 1; i < hole2d.length; i++) {
      path.lineTo(hole2d[i].x, hole2d[i].y);
    }
    path.closePath();
    shape.holes.push(path);
  }

  const geometry = new ShapeGeometry(shape);

  // Shape space (x, y, z) → world: x·u + y·v + z·n + origin, with the origin
  // lifted along the normal.
  const matrix = new Matrix4().makeBasis(
    new Vector3(basis.u.x, basis.u.y, basis.u.z),
    new Vector3(basis.v.x, basis.v.y, basis.v.z),
    new Vector3(basis.n.x, basis.n.y, basis.n.z)
  );
  matrix.setPosition(
    basis.origin.x + basis.n.x * MESH3D_LIFT_M,
    basis.origin.y + basis.n.y * MESH3D_LIFT_M,
    basis.origin.z + basis.n.z * MESH3D_LIFT_M
  );
  geometry.applyMatrix4(matrix);

  // `dimmed`: a selection exists elsewhere — same "everything translucent
  // except the selection" mechanism as annotations (STATE_DIM).
  // DoubleSide: a surface with no thickness must still read from behind.
  const material = new MeshStandardMaterial({
    color: selected ? safeLighten(color, 0.3, color) : color,
    transparent: true,
    opacity: dimmed ? 0.2 : 0.9,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const mesh = new Mesh(geometry, material);

  // Contour outline: keeps the source annotation's raw color (the fill is a
  // lightened shade of it); blue when selected, faded when dimmed.
  const edges = new LineSegments(
    new EdgesGeometry(geometry, 20),
    new LineBasicMaterial({
      color: selected ? 0x2196f3 : edgeColor || 0x333333,
      transparent: true,
      opacity: dimmed ? 0.25 : 1,
    })
  );
  edges.raycast = () => {};
  edges.renderOrder = 999;
  mesh.add(edges);

  return mesh;
}
