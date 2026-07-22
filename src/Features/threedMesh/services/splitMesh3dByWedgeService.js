import db from "App/db/db";

import createMesh3dService from "./createMesh3dService";
import { computeMesh3dSurface } from "../utils/computeFaceArea";

// Commits an angular cut: the two sides produced by cutMesh3dByPlanes become
// two mailles. Same identity rule as splitMesh3dService — the LARGER side
// keeps the original record (id / number / label / color), the other becomes a
// new maille (fresh number, no custom label, same color).
//
// Unlike splitMesh3dService this cuts the maille as a WHOLE (every face of a
// multi-face record, or the full shell), because the wedge is a pair of world
// half-spaces rather than a path drawn on one face plane.
export default async function splitMesh3dByWedgeService({
  mesh3d,
  inside,
  outside,
}) {
  if (!mesh3d || !inside || !outside) return null;

  const [keep, rest] =
    inside.surface >= outside.surface ? [inside, outside] : [outside, inside];

  const payload = (side) =>
    side.faces
      ? { faces: side.faces, surface: computeMesh3dSurface(side.faces) }
      : { shell: side.shell, surface: side.shell.surface };

  const keepPayload = payload(keep);
  const restPayload = payload(rest);

  return db.transaction("rw", db.meshes3d, async () => {
    await db.meshes3d.update(mesh3d.id, {
      faces: keepPayload.faces || null,
      shell: keepPayload.shell || null,
      surface: keepPayload.surface,
    });
    const seams = mesh3d.seams || [];

    const record = await createMesh3dService({
      projectId: mesh3d.projectId,
      scopeId: mesh3d.scopeId,
      faces: restPayload.faces || null,
      shell: restPayload.shell || null,
      // Both sides stay open along the seams the maille already carried.
      seams,
      baseColor: mesh3d.baseColor ?? mesh3d.color,
      edgeColor: mesh3d.edgeColor || null,
      sourceInfo: mesh3d.sourceInfo || null,
    });

    return { keptId: mesh3d.id, newIds: record ? [record.id] : [] };
  });
}
