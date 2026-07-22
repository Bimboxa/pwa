import db from "App/db/db";

import createMesh3dService from "./createMesh3dService";
import computePlaneBasis from "../utils/computePlaneBasis";
import cutShellByPlane from "../utils/cutShellByPlane";
import { projectLoopTo2d, liftLoopTo3d } from "../utils/planeProjection";
import splitFacePolygon from "../utils/splitFacePolygon";
import { computeMesh3dSurface } from "../utils/computeFaceArea";

// Splits one face of a maille along the (a, b) cut line, or along `path` (a
// polyline whose endpoints sit on the face boundary) — 2D coords in the face
// plane basis. A curved (shell) maille is split by `plane` instead
// ({normal, constant}, world coords). The LARGEST resulting piece keeps the
// original maille's identity (id / number / label / color, and its other
// faces when the maille is multi-face); every other piece becomes a new
// maille (fresh number, no custom label, same color).
export default async function splitMesh3dService({
  mesh3d,
  faceIndex,
  a,
  b,
  path,
  plane,
}) {
  if (plane && mesh3d?.shell?.positions?.length) {
    return splitShell({ mesh3d, plane });
  }

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
    path,
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
      // New pieces re-shade from the parent's base color with their fresh
      // number, so the two sides of a cut never look identical.
      const record = await createMesh3dService({
        projectId: mesh3d.projectId,
        scopeId: mesh3d.scopeId,
        faces: [toFace3d(piece)],
        baseColor: mesh3d.baseColor ?? mesh3d.color,
        edgeColor: mesh3d.edgeColor || null,
        sourceInfo: mesh3d.sourceInfo || null,
      });
      if (record) newIds.push(record.id);
    }

    return { keptId: mesh3d.id, newIds };
  });
}

// Curved maille: the plane splits the triangle soup itself. The bigger side
// stays on the record, the smaller becomes a new maille.
async function splitShell({ mesh3d, plane }) {
  const { positive, negative } = cutShellByPlane({
    positions: mesh3d.shell.positions,
    plane,
  });
  if (!positive || !negative) return null;

  const [keep, rest] =
    positive.surface >= negative.surface
      ? [positive, negative]
      : [negative, positive];

  return db.transaction("rw", db.meshes3d, async () => {
    await db.meshes3d.update(mesh3d.id, {
      shell: keep,
      surface: keep.surface,
    });

    const record = await createMesh3dService({
      projectId: mesh3d.projectId,
      scopeId: mesh3d.scopeId,
      shell: rest,
      baseColor: mesh3d.baseColor ?? mesh3d.color,
      edgeColor: mesh3d.edgeColor || null,
      sourceInfo: mesh3d.sourceInfo || null,
    });

    return { keptId: mesh3d.id, newIds: record ? [record.id] : [] };
  });
}
