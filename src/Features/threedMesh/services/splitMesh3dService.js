import db from "App/db/db";

import createMesh3dService from "./createMesh3dService";
import computePlaneBasis from "../utils/computePlaneBasis";
import { projectLoopTo2d, liftLoopTo3d } from "../utils/planeProjection";
import splitFacePolygon from "../utils/splitFacePolygon";
import { computeMesh3dSurface } from "../utils/computeFaceArea";

// Splits one face of a maille along the (a, b) cut line (2D coords in the
// face plane basis). The LARGEST resulting piece keeps the original maille's
// identity (id / number / label / color, and its other faces when the maille
// is multi-face); every other piece becomes a new maille (fresh number, no
// custom label, same color).
export default async function splitMesh3dService({
  mesh3d,
  faceIndex,
  a,
  b,
  clampToSegment = false,
}) {
  const face = mesh3d?.faces?.[faceIndex];
  if (!face) return null;

  const basis = computePlaneBasis(face.normal, face.contour[0]);
  const contour2d = projectLoopTo2d(face.contour, basis);
  const holes2d = (face.holes || []).map((hole) =>
    projectLoopTo2d(hole, basis)
  );

  const pieces = splitFacePolygon({
    contour: contour2d,
    holes: holes2d,
    a,
    b,
    clampToSegment,
  });
  if (!pieces || pieces.length < 2) return null;

  const toFace3d = (piece) => ({
    contour: liftLoopTo3d(piece.contour, basis),
    holes: piece.holes.map((hole) => liftLoopTo3d(hole, basis)),
    normal: face.normal,
  });

  const [keep, ...rest] = pieces; // sorted by area desc

  const keptFaces = mesh3d.faces.map((f, i) =>
    i === faceIndex ? toFace3d(keep) : f
  );

  return db.transaction("rw", db.meshes3d, async () => {
    await db.meshes3d.update(mesh3d.id, {
      faces: keptFaces,
      surface: computeMesh3dSurface(keptFaces),
    });

    const newIds = [];
    for (const piece of rest) {
      const record = await createMesh3dService({
        projectId: mesh3d.projectId,
        scopeId: mesh3d.scopeId,
        faces: [toFace3d(piece)],
        color: mesh3d.color,
        sourceInfo: mesh3d.sourceInfo || null,
      });
      if (record) newIds.push(record.id);
    }

    return { keptId: mesh3d.id, newIds };
  });
}
