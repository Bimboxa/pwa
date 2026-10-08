import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import getEditableMesh3d from "Features/annotationMesh3d/services/getEditableMesh3d";
import writeMesh3dService from "Features/annotationMesh3d/services/writeMesh3dService";

import { MERGE_FACES_REASONS } from "../utils/mergeFacesMessages";
import mergeMesh3dSolids from "../utils/mergeMesh3dSolids";

// « Fusionner des faces »: merges the mesh of `otherAnnotationId` into the
// SEED annotation, which keeps its id, template, listing and relations; the
// other annotation is deleted. ONE undo step (the seed row rewrite, the
// re-hosted paints and the cascaded deletion come back together).
//
// Both meshes are read as 3D tools do (getEditableMesh3d: a regular
// annotation is converted in memory from its un-shrunk 3D object, a mesh
// annotation gives its stored mesh), put in the base map local frame with
// absolute z, unioned by mergeMesh3dSolids and written back through the
// single mesh write path (writeMesh3dService: the seed becomes POLYGON
// isMesh3d, its plan projection is re-derived).
//
// seedPlane: { point, normal } (base map local frame, absolute z) of the
// face the merge was launched from — the merge is refused when the other
// annotation's faces do not touch the seed's on that plane.
//
// Returns { status: "done", annotation } | { status: "refused", reason }
// (reasons: mergeFacesMessages MERGE_FACES_REASONS).

const refused = (reason) => ({ status: "refused", reason });

// Same origin type: a mesh annotation is POLYGON whatever it was drawn as,
// so the type it was converted from (mesh3dSource) is what counts. A
// template implies a type: two annotations of the same template qualify;
// template-less ones compare their origin types.
export function getAnnotationOriginType(annotation) {
  return annotation?.mesh3dSource?.fields?.type ?? annotation?.type ?? null;
}

export function areMergeableTypes(a, b) {
  if (!a || !b) return false;
  if (a.annotationTemplateId || b.annotationTemplateId) {
    return a.annotationTemplateId === b.annotationTemplateId;
  }
  return getAnnotationOriginType(a) === getAnnotationOriginType(b);
}

// Openings are glued on their host and a subtraction points at one
// annotation: neither survives a merge (same rule as the 2D split of
// « Coupe face »).
async function hasOpeningsOrSubtractions(annotationId) {
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

const withAbsoluteZ = (ctx) => ({
  vertices: ctx.mesh.vertices.map((v) => ({
    x: v.x,
    y: v.y,
    z: v.z + (Number(ctx.baseOffsetZ) || 0),
  })),
  faces: ctx.mesh.faces,
});

export default async function mergeAnnotationMeshesService({
  seedAnnotationId,
  otherAnnotationId,
  seedPlane,
  editor,
  dispatch,
  deleteAnnotationsFn,
}) {
  if (!seedAnnotationId || !otherAnnotationId || !editor?.sceneManager) {
    return refused(MERGE_FACES_REASONS.NOT_FOUND);
  }
  if (seedAnnotationId === otherAnnotationId) {
    return refused(MERGE_FACES_REASONS.SAME_ANNOTATION);
  }
  if (
    isForeignFootprintId(seedAnnotationId) ||
    isForeignFootprintId(otherAnnotationId)
  ) {
    return refused(MERGE_FACES_REASONS.NOT_EDITABLE);
  }

  const [seed, other] = await db.annotations.bulkGet([
    seedAnnotationId,
    otherAnnotationId,
  ]);
  if (!seed || seed.deletedAt || !other || other.deletedAt) {
    return refused(MERGE_FACES_REASONS.NOT_FOUND);
  }
  if (seed.baseMapId !== other.baseMapId) {
    return refused(MERGE_FACES_REASONS.DIFFERENT_BASE_MAP);
  }
  if (!areMergeableTypes(seed, other)) {
    return refused(MERGE_FACES_REASONS.DIFFERENT_TYPE);
  }
  const [seedHasRels, otherHasRels] = await Promise.all([
    hasOpeningsOrSubtractions(seed.id),
    hasOpeningsOrSubtractions(other.id),
  ]);
  if (seedHasRels || otherHasRels) {
    return refused(MERGE_FACES_REASONS.HAS_RELATIONS);
  }

  const seedCtx = await getEditableMesh3d({ editor, annotationId: seed.id });
  const otherCtx = await getEditableMesh3d({
    editor,
    annotationId: other.id,
  });
  if (!seedCtx?.mesh?.faces?.length || !otherCtx?.mesh?.faces?.length) {
    return refused(MERGE_FACES_REASONS.NOT_EDITABLE);
  }

  const merged = mergeMesh3dSolids(
    withAbsoluteZ(seedCtx),
    withAbsoluteZ(otherCtx),
    { seedPlane }
  );
  if (!merged.ok) return refused(merged.reason);

  let written = null;
  await withUndoGroup(async () => {
    // Painted parts of the absorbed annotation follow the merged solid: the
    // re-sync re-locates them geometrically on the seed.
    const paints = (
      await db.meshPaints.where("hostAnnotationId").equals(other.id).toArray()
    ).filter((row) => !row.deletedAt);
    for (const row of paints) {
      await db.meshPaints.update(row.id, { hostAnnotationId: seed.id });
    }
    written = await writeMesh3dService({
      annotation: seedCtx.annotation,
      mesh: merged.mesh,
      baseOffsetZ: 0,
      metrics: seedCtx.metrics,
      dispatch,
    });
    if (!written) throw new Error("[threedMergeFaces] mesh write failed");
    await deleteAnnotationsFn([other.id]);
  });
  dispatch?.(triggerAnnotationsUpdate());

  return { status: "done", annotation: written };
}
