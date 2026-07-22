import computeFaceArea, { polygonCentroid2d } from "./computeFaceArea.js";
import computePlaneBasis from "./computePlaneBasis.js";
import cutFacesByPlaneNear from "./cutFacesByPlaneNear.js";
import cutShellByPlaneNear from "./cutShellByPlaneNear.js";
import getShellCentroid from "./getShellCentroid.js";
import { liftPointTo3d } from "./planeProjection.js";

// Axis cut (vertical / horizontal tools) of a maille by a world plane,
// restricted to the facets facing the user — dispatches on the geometry model
// and normalizes both results to the same piece shape:
//
//   { faces?, shell?, surface, seams, centroid }
//
// pieces[0] is the largest one (it keeps the record's identity on commit); a
// single piece means the cut opened the maille without separating it.

function getPieceCentroid(piece) {
  if (piece.shell) return getShellCentroid(piece.shell.positions)?.centroid;
  let best = null;
  for (const face of piece.faces || []) {
    const area = computeFaceArea(face);
    if (!best || area > best.area) best = { area, face };
  }
  if (!best) return null;
  const { face } = best;
  const basis = computePlaneBasis(face.normal, face.contour[0]);
  const contour2d = face.contour.map((p) => ({
    x:
      (p.x - basis.origin.x) * basis.u.x +
      (p.y - basis.origin.y) * basis.u.y +
      (p.z - basis.origin.z) * basis.u.z,
    y:
      (p.x - basis.origin.x) * basis.v.x +
      (p.y - basis.origin.y) * basis.v.y +
      (p.z - basis.origin.z) * basis.v.z,
  }));
  return liftPointTo3d(polygonCentroid2d(contour2d), basis);
}

export default function cutMesh3dByPlaneNear({ mesh3d, plane, hitPoint }) {
  if (!mesh3d || !plane) return null;
  const seams = mesh3d.seams || [];

  const result = mesh3d.shell?.positions?.length
    ? cutShellByPlaneNear({
        positions: mesh3d.shell.positions,
        plane,
        hitPoint,
        seams,
      })
    : cutFacesByPlaneNear({ faces: mesh3d.faces, plane, hitPoint, seams });
  if (!result?.pieces?.length) return null;

  return {
    ...result,
    pieces: result.pieces.map((piece) => ({
      faces: piece.faces || null,
      shell: piece.shell || null,
      surface: piece.shell ? piece.shell.surface : piece.surface,
      seams: piece.seams || [],
      centroid: getPieceCentroid(piece),
    })),
  };
}
