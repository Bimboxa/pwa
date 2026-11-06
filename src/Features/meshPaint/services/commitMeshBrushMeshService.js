import db from "App/db/db";
import store from "App/store";
import { withUndoGroup } from "App/db/undoManager";

import createMesh3dAnnotationFromLocalMeshService from "Features/annotationMesh3d/services/createMesh3dAnnotationFromLocalMeshService";
import { normalizedToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import { removeShrinkExemptAnnotationIds } from "Features/meshPaint/meshPaintSlice";
import { MESH_BRUSH_AUTO_GEN_KIND } from "Features/meshPaint/services/commitMeshBrush2dService";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import localFaceToMesh3d from "Features/meshPaint/utils/localFaceToMesh3d";

// « Pinceau » with « Créer une annotation »: a painted FACET the plan cannot
// hold (commitMeshBrush2dService answered FALLBACK: curved surface,
// multi-polygon facet, oblique face with holes…) becomes a NEW annotation
// holding a mesh (`isMesh3d`) — a sheet looking at the painted side, with
// the armed template, its listing and the host's layer, marked like the 2D
// brush annotations (`autoCreatedFrom` = host, `autoGenKind` MESH_BRUSH).
// It is also the only thing the brush can make on a host too dense for the
// part index (an imported heavy model).
//
// Without a host annotation (`hostId` null: a facet of the GLB scene of a
// scan base map) the annotation is a plain one of the base map — no
// provenance marker.
//
// Duplicate guard: a live annotation mesh of the same template, made from
// the same host (or from no host), with the same vertices → nothing written.

export const BRUSH_MESH_STATUS = Object.freeze({
  CREATED: "CREATED",
  DUPLICATE: "DUPLICATE",
  FALLBACK: "FALLBACK",
});

// Two meshes are at the same place when their vertices match within this (m).
const SAME_VERTEX_TOL_M = 2e-3;

const fallback = (reason) => ({ status: BRUSH_MESH_STATUS.FALLBACK, reason });

export default async function commitMeshBrushMeshService({
  editor,
  hostId,
  baseMapId,
  localGeometry,
  host,
  template,
  templateProps,
  projectId,
  scopeId,
  createAnnotationFn = null,
}) {
  const imagesManager = editor?.sceneManager?.imagesManager;
  const baseMap = imagesManager?.baseMapsMap?.[baseMapId];
  const metrics = getMeshPaintMetrics(baseMap);
  if (!baseMap || !metrics) return fallback("NO_BASE_MAP");
  if (!template?.id || !templateProps?.annotationTemplateId)
    return fallback("NO_TEMPLATE");

  const mesh = localFaceToMesh3d(localGeometry);
  if (!mesh) return fallback("NO_MESH");

  const duplicateOfId = await findSamePlaceMesh3dAnnotation({
    baseMapId,
    metrics,
    annotationTemplateId: template.id,
    hostId,
    vertices: mesh.vertices,
  });
  if (duplicateOfId) {
    return { status: BRUSH_MESH_STATUS.DUPLICATE, duplicateOfId };
  }

  const annotation = await withUndoGroup(() =>
    createMesh3dAnnotationFromLocalMeshService({
      mesh,
      baseMapId,
      metrics,
      projectId,
      scopeId,
      listingId: template.listingId ?? templateProps.listingId ?? null,
      draftProps: templateProps,
      layerId: host?.layerId ?? null,
      // none without a host annotation (a GLB scene facet)
      extraFields: hostId
        ? { autoCreatedFrom: hostId, autoGenKind: MESH_BRUSH_AUTO_GEN_KIND }
        : null,
      createAnnotationFn,
    })
  );
  if (!annotation) return fallback("NO_STORAGE");

  // No paint was written: the host keeps its anti-aliasing shrink.
  if (hostId) store.dispatch(removeShrinkExemptAnnotationIds([hostId]));
  return { status: BRUSH_MESH_STATUS.CREATED, annotationIds: [annotation.id] };
}

// Id of a live brush-made annotation mesh of that template and host whose
// vertices are the candidate's (LOCAL meters, z absolute), or null.
async function findSamePlaceMesh3dAnnotation({
  baseMapId,
  metrics,
  annotationTemplateId,
  hostId,
  vertices,
}) {
  const rows = await db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  const tolSq = SAME_VERTEX_TOL_M * SAME_VERTEX_TOL_M;
  for (const row of rows) {
    if (
      row.deletedAt ||
      !row.isMesh3d ||
      row.annotationTemplateId !== annotationTemplateId ||
      (row.autoCreatedFrom ?? null) !== (hostId ?? null) ||
      row.mesh3d?.vertices?.length !== vertices.length
    ) {
      continue;
    }
    const offsetZ = Number(row.offsetZ) || 0;
    const existing = row.mesh3d.vertices.map((v) => {
      const local = normalizedToLocal(v, metrics);
      return { x: local.x, y: local.y, z: local.z + offsetZ };
    });
    const isSame = vertices.every((p) =>
      existing.some(
        (q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 <= tolSq
      )
    );
    if (isSame) return row.id;
  }
  return null;
}
