import db from "App/db/db";

// Gates and frame helpers shared by the two annotation merges of the 3D
// editor (mergeAnnotationMeshesService, mergeAnnotationsToMeshService).

// Openings are glued on their host and a subtraction points at one
// annotation: neither survives a merge (same rule as the 2D split of
// « Coupe face »).
export async function hasOpeningsOrSubtractions(annotationId) {
  const [openings, asSource, asTarget] = await Promise.all([
    db.relAnnotationOpenings
      .where("hostAnnotationId")
      .equals(annotationId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("sourceAnnotationId")
      .equals(annotationId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("targetAnnotationId")
      .equals(annotationId)
      .toArray(),
  ]);
  return [...openings, ...asSource, ...asTarget].some((rel) => !rel.deletedAt);
}

// The editable mesh of getEditableMesh3d with ABSOLUTE local z (its z is
// measured from baseOffsetZ) — the frame mergeMesh3dSolids works in.
export const withAbsoluteZ = (ctx) => ({
  vertices: ctx.mesh.vertices.map((v) => ({
    x: v.x,
    y: v.y,
    z: v.z + (Number(ctx.baseOffsetZ) || 0),
  })),
  faces: ctx.mesh.faces,
});

// Re-hosts the painted parts (db.meshPaints) of the absorbed annotations on
// the seed: the re-sync re-locates them geometrically on the merged solid.
export async function rehostMeshPaints(absorbedIds, seedId) {
  for (const absorbedId of absorbedIds) {
    const paints = (
      await db.meshPaints.where("hostAnnotationId").equals(absorbedId).toArray()
    ).filter((row) => !row.deletedAt);
    for (const row of paints) {
      await db.meshPaints.update(row.id, { hostAnnotationId: seedId });
    }
  }
}
