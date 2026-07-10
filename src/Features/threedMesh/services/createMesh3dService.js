import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { computeMesh3dSurface } from "../utils/computeFaceArea";
import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

// Creates a maille. `number` is allocated inside the transaction as
// 1 + max(number) over ALL rows of the scope INCLUDING soft-deleted ones
// (rows are never physically removed), so numbers are never reused.
export default async function createMesh3dService({
  projectId,
  scopeId,
  faces,
  color = DEFAULT_MESH3D_COLOR,
  label = null,
  sourceInfo = null,
}) {
  if (!projectId || !scopeId || !faces?.length) return null;

  return db.transaction("rw", db.meshes3d, async () => {
    const rows = await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();
    const number = 1 + rows.reduce((max, r) => Math.max(max, r.number || 0), 0);

    const record = {
      id: nanoid(),
      projectId,
      scopeId,
      number,
      label,
      color,
      surface: computeMesh3dSurface(faces),
      faces,
      sourceInfo,
    };
    await db.meshes3d.add(record);
    return record;
  });
}
