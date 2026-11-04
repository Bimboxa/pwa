import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import getEditableMesh3d from "Features/annotationMesh3d/services/getEditableMesh3d";
import unionMesh3dSolids, {
  getMesh3dOverlapVolume,
  MIN_OVERLAP_VOLUME_M3,
} from "Features/annotationMesh3d/services/unionMesh3dSolids";
import writeMesh3dService from "Features/annotationMesh3d/services/writeMesh3dService";
import isMesh3dClosed from "Features/annotationMesh3d/utils/isMesh3dClosed";
import { resolveMergeTemplate } from "Features/commandsToolbar/commands/merge/resolveMergeSelection";

import { MERGE_FACES_REASONS } from "../utils/mergeFacesMessages";
import mergeMesh3dMeshes from "../utils/mergeMesh3dMeshes";
import mergeMesh3dSolids from "../utils/mergeMesh3dSolids";
import {
  hasOpeningsOrSubtractions,
  rehostMeshPaints,
  withAbsoluteZ,
} from "./mergeAnnotationGates";

// Mesh mode of « Fusionner les annotations » (3D editor): merges the
// selected annotations into ONE mesh annotation. The SEED keeps its id,
// template, listing and relations and receives the merged mesh
// (writeMesh3dService: it becomes POLYGON isMesh3d, its plan projection is
// re-derived, mesh3dSource is taken at its first conversion); the other
// annotations are deleted. ONE undo step.
//
// Seed: the first selected annotation carrying the (single) template of the
// selection, else the first selected one — template-less shapes absorbed by
// a templated one take its template (resolveMergeTemplate). Types may differ
// (a POLYLINE wall with a POLYGON slab), unlike « Fusionner des faces ».
//
// Meshes: every annotation is read as the 3D tools do (getEditableMesh3d —
// a regular annotation is converted in memory from its un-shrunk live 3D
// object, a mesh annotation gives its stored mesh), OPEN meshes included
// (allowOpen: a PX polyline wall is a chain of zero-thickness quads, a flat
// polygon is a sheet), and put in the base map local frame with absolute z.
//
// Pair rule (mergeMesh3dMeshes folds the seed with the others, in an order
// that works): two CLOSED solids whose volumes overlap (a wall through a
// slab) are unioned by CSG (unionMesh3dSolids, three-bvh-csg ADDITION);
// every other pair — sheets, solids touching by a face, an edge or a vertex
// — goes through the planar merge (mergeMesh3dSolids: contact faces
// resolved, coplanar faces unioned, weld + T-junctions, connectivity check).
//
// Returns { status: "done", annotation } | { status: "refused", reason }
// (reasons: mergeFacesMessages MERGE_FACES_REASONS).

const refused = (reason) => ({ status: "refused", reason });

function mergePair(seed, other) {
  if (isMesh3dClosed(seed) && isMesh3dClosed(other)) {
    let overlap = 0;
    try {
      overlap = getMesh3dOverlapVolume(seed, other);
    } catch (error) {
      console.warn("[threedMergeFaces] overlap volume failed", error);
    }
    if (overlap > MIN_OVERLAP_VOLUME_M3) {
      const union = unionMesh3dSolids(seed, other);
      if (union.ok) return union;
      console.warn(
        `[threedMergeFaces] CSG union failed (${union.reason}), falling back to the planar merge`
      );
    }
  }
  return mergeMesh3dSolids(seed, other);
}

export default async function mergeAnnotationsToMeshService({
  annotationIds,
  editor,
  dispatch,
  deleteAnnotationsFn,
}) {
  const ids = [...new Set((annotationIds || []).filter(Boolean))];
  if (!editor?.sceneManager) return refused(MERGE_FACES_REASONS.NOT_FOUND);
  if (ids.length < 2) return refused(MERGE_FACES_REASONS.TOO_FEW);
  if (ids.some(isForeignFootprintId)) {
    return refused(MERGE_FACES_REASONS.NOT_EDITABLE);
  }

  const rows = await db.annotations.bulkGet(ids);
  if (rows.some((row) => !row || row.deletedAt)) {
    return refused(MERGE_FACES_REASONS.NOT_FOUND);
  }
  if (rows.some((row) => row.baseMapId !== rows[0].baseMapId)) {
    return refused(MERGE_FACES_REASONS.DIFFERENT_BASE_MAP);
  }
  const template = resolveMergeTemplate(rows);
  if (!template.ok) return refused(MERGE_FACES_REASONS.MIXED_TEMPLATES);
  const seed = rows[template.seedIndex];
  const others = rows.filter((row) => row.id !== seed.id);

  const relations = await Promise.all(
    rows.map((row) => hasOpeningsOrSubtractions(row.id))
  );
  if (relations.some(Boolean)) {
    return refused(MERGE_FACES_REASONS.HAS_RELATIONS);
  }

  const ctxs = [];
  for (const row of [seed, ...others]) {
    const ctx = await getEditableMesh3d({
      editor,
      annotationId: row.id,
      allowOpen: true,
    });
    if (!ctx?.mesh?.faces?.length) {
      return refused(MERGE_FACES_REASONS.NOT_EDITABLE);
    }
    ctxs.push(ctx);
  }
  const seedCtx = ctxs[0];

  const merged = mergeMesh3dMeshes(ctxs.map(withAbsoluteZ), { mergePair });
  if (!merged.ok) return refused(merged.reason);

  const absorbedIds = others.map((row) => row.id);
  let written = null;
  await withUndoGroup(async () => {
    await rehostMeshPaints(absorbedIds, seed.id);
    written = await writeMesh3dService({
      annotation: seedCtx.annotation,
      mesh: merged.mesh,
      baseOffsetZ: 0,
      metrics: seedCtx.metrics,
      dispatch,
    });
    if (!written) throw new Error("[threedMergeFaces] mesh write failed");
    await deleteAnnotationsFn(absorbedIds);
  });
  dispatch?.(triggerAnnotationsUpdate());

  return { status: "done", annotation: written };
}
