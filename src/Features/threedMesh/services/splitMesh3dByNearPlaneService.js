import db from "App/db/db";

import createMesh3dService from "./createMesh3dService";

// Commits an axis cut computed by cutMesh3dByPlaneNear. The LARGEST piece
// keeps the original record (id / number / label / color), every other piece
// becomes a new maille — same identity rule as splitMesh3dService.
//
// A single piece is the "opened" case: the cut went through a wrapped maille
// (a 360° ribbon) without separating it. Nothing is created, but the record
// still takes the subdivided geometry and the new seam, so the NEXT cut
// elsewhere really splits it in two.
export default async function splitMesh3dByNearPlaneService({
  mesh3d,
  pieces,
}) {
  if (!mesh3d || !pieces?.length) return null;
  const [keep, ...rest] = pieces;

  return db.transaction("rw", db.meshes3d, async () => {
    await db.meshes3d.update(mesh3d.id, {
      faces: keep.faces || null,
      shell: keep.shell || null,
      surface: keep.surface,
      seams: keep.seams || [],
    });

    const newIds = [];
    for (const piece of rest) {
      const record = await createMesh3dService({
        projectId: mesh3d.projectId,
        scopeId: mesh3d.scopeId,
        faces: piece.faces || null,
        shell: piece.shell || null,
        seams: piece.seams || [],
        baseColor: mesh3d.baseColor ?? mesh3d.color,
        edgeColor: mesh3d.edgeColor || null,
        sourceInfo: mesh3d.sourceInfo || null,
      });
      if (record) newIds.push(record.id);
    }

    return { keptId: mesh3d.id, newIds, opened: rest.length === 0 };
  });
}
