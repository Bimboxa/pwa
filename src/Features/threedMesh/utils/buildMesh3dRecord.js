import { nanoid } from "@reduxjs/toolkit";

import { computeMesh3dSurface } from "./computeFaceArea";
import getMesh3dCreationColors from "./getMesh3dCreationColors";
import getMesh3dLoops from "./getMesh3dLoops";
import findAdjacentMeshes3d from "./findAdjacentMeshes3d";

// Builds a maille record in memory (no DB access) against `rows`, ALL the
// meshes3d rows of the scope INCLUDING soft-deleted ones — plus, in a batch,
// the records already built in the same run.
//
// `number` is 1 + max(number) over `rows` (rows are never physically
// removed, so numbers are never reused).
//
// Colors: `baseColor` is the source annotation's color — the fill is a
// lightened shade of it picked to contrast with the ADJACENT mailles (same
// palette, so touching mailles stay visually distinct) and the edges keep
// the raw color. Explicit `color` / `edgeColor` win when provided (splits
// preserve the parent's edge color).
//
// Returns null when the maille has no geometry.
export default function buildMesh3dRecord(
  {
    projectId,
    scopeId,
    faces = null,
    shell = null,
    // Cut segments the maille is already opened along — see seamUtils.
    seams = [],
    baseColor = null,
    color = null,
    edgeColor = null,
    label = null,
    sourceInfo = null,
  },
  rows
) {
  // A maille is either planar (polygon faces) or curved (triangulated shell).
  if (!faces?.length && !shell?.positions?.length) return null;

  const number = 1 + rows.reduce((max, r) => Math.max(max, r.number || 0), 0);

  const neighbors = findAdjacentMeshes3d(
    getMesh3dLoops({ faces, shell }),
    rows.filter((r) => !r.deletedAt)
  );
  const colors = getMesh3dCreationColors(
    baseColor,
    number,
    neighbors.map((r) => r.color)
  );

  return {
    id: nanoid(),
    projectId,
    scopeId,
    number,
    label,
    baseColor,
    color: color || colors.color,
    edgeColor: edgeColor || colors.edgeColor,
    surface: shell ? shell.surface : computeMesh3dSurface(faces),
    faces: faces || [],
    shell: shell || null,
    seams: seams || [],
    sourceInfo,
  };
}
