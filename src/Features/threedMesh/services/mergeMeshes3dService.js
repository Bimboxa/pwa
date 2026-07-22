import db from "App/db/db";

import coalesceCoplanarFaces from "../utils/coalesceCoplanarFaces";
import { computeMesh3dSurface } from "../utils/computeFaceArea";

// Merges N mailles into one — faces may lie on DIFFERENT planes (a maille is
// multi-face by design). Coplanar same-facing faces that touch or overlap are
// unioned into a single face (single displayed mesh); the others are kept
// as-is. The survivor is the maille with the LOWEST number (it keeps id /
// number / label / color); the others are soft-deleted. The merged surface is
// the sum of all face areas.
//
// Curved (shell) mailles are excluded: a triangulated surface has no polygon
// to union, so merging one would silently drop its geometry.
export default async function mergeMeshes3dService(mesh3dIds) {
  const ids = (mesh3dIds || []).filter(Boolean);
  if (ids.length < 2) return null;

  return db.transaction("rw", db.meshes3d, async () => {
    const records = (await db.meshes3d.bulkGet(ids)).filter(
      (r) => r && !r.deletedAt
    );
    if (records.length < 2) return null;
    if (records.some((r) => r.shell?.positions?.length)) return null;

    records.sort((r1, r2) => (r1.number || 0) - (r2.number || 0));
    const [survivor, ...others] = records;

    const faces = coalesceCoplanarFaces(records.flatMap((r) => r.faces || []));
    await db.meshes3d.update(survivor.id, {
      faces,
      surface: computeMesh3dSurface(faces),
      // Merging is the explicit "these are one maille again" gesture, so the
      // seams the cuts left behind are dropped — keeping them would leave the
      // survivor open right where the pieces were just rejoined, and the next
      // axis cut would split them apart again (see seamUtils).
      seams: [],
    });
    await db.meshes3d.bulkDelete(others.map((r) => r.id));

    return survivor.id;
  });
}
