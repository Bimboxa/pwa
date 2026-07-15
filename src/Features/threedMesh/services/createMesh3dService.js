import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { computeMesh3dSurface } from "../utils/computeFaceArea";
import getMesh3dCreationColors from "../utils/getMesh3dCreationColors";
import findAdjacentMeshes3d from "../utils/findAdjacentMeshes3d";

// Creates a maille. `number` is allocated inside the transaction as
// 1 + max(number) over ALL rows of the scope INCLUDING soft-deleted ones
// (rows are never physically removed), so numbers are never reused.
//
// Colors: `baseColor` is the source annotation's color — the fill is a
// lightened shade of it picked to contrast with the ADJACENT mailles (same
// palette, so touching mailles stay visually distinct) and the edges keep
// the raw color. Explicit `color` / `edgeColor` win when provided (splits
// preserve the parent's edge color).
export default async function createMesh3dService({
  projectId,
  scopeId,
  faces,
  baseColor = null,
  color = null,
  edgeColor = null,
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

    const neighbors = findAdjacentMeshes3d(
      faces,
      rows.filter((r) => !r.deletedAt)
    );
    const colors = getMesh3dCreationColors(
      baseColor,
      number,
      neighbors.map((r) => r.color)
    );

    const record = {
      id: nanoid(),
      projectId,
      scopeId,
      number,
      label,
      baseColor,
      color: color || colors.color,
      edgeColor: edgeColor || colors.edgeColor,
      surface: computeMesh3dSurface(faces),
      faces,
      sourceInfo,
    };
    await db.meshes3d.add(record);
    return record;
  });
}
