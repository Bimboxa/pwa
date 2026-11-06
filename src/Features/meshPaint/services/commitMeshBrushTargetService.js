import db from "App/db/db";

import commitMeshBrush2dService, {
  BRUSH_2D_STATUS,
} from "Features/meshPaint/services/commitMeshBrush2dService";
import commitMeshBrushMeshService, {
  BRUSH_MESH_STATUS,
} from "Features/meshPaint/services/commitMeshBrushMeshService";
import ensureUnshrunkHostObject from "Features/meshPaint/services/ensureUnshrunkHostObject";
import paintMeshPartService from "Features/meshPaint/services/paintMeshPartService";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";
import { getHostPartData } from "Features/meshPaint/js/buildHostPartIndexFromObject";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import { localGeometryToPaint } from "Features/meshPaint/utils/meshPaintFrame";
import { matchPaintPartToIndex } from "Features/meshPaint/utils/planPaintResync";

/**
 * Commit of one « Pinceau » click on a picked target (meshBrushPick).
 *
 * - PAINT (an existing paint under the cursor): the candidate is the paint
 *   itself (its row's geometry and host) — paintMeshPartService removes it
 *   (same template) or replaces it.
 * - HOST: the host is first rebuilt WITHOUT the anti-aliasing shrink
 *   (ensureUnshrunkHostObject: a painted host is never shrunk, and the
 *   measured face / edge must be the real one), then the picked part is
 *   re-detected on the rebuilt object — Stage 1 of the re-sync matching
 *   (parallel part within 20 mm, the facets an edge borders included) — and
 *   stored with the host geometry hash (the re-sync then has nothing to do).
 *   A part not found again keeps its picked geometry, without hash (the next
 *   re-sync decides).
 * - HOST with `createAsAnnotation` (drawing helper switch « Créer une
 *   annotation »): the re-detected part is first offered to
 *   commitMeshBrush2dService — CREATED → action "CREATED_2D" (no paint row);
 *   NO_GROUND (thick wall facet without a floor polygon at its foot) →
 *   nothing written, reason "NO_GROUND" (the caller shows a toaster);
 *   DUPLICATE (a live annotation of the same template and type already at
 *   that place) → nothing written, reason "DUPLICATE" (toaster too);
 *   FALLBACK (no plan encoding) → a FACET becomes a new annotation mesh
 *   (commitMeshBrushMeshService: action "CREATED_MESH", or reason
 *   "DUPLICATE"); an edge, or a facet the mesh builder gives up on, gets the
 *   paint row as usual.
 * - HOST too dense for the part index (`target.dense`, an imported heavy
 *   model — see meshBrushPick): the picked facet stands as it is (no
 *   un-shrink, no re-detection: both read the whole host) and ALWAYS becomes
 *   an annotation, whatever the switch; nothing is painted (a paint row
 *   needs the index to be re-synced).
 *
 * @param {object} params
 * @param {object} params.editor - the active ThreedEditor
 * @param {object} params.target - meshBrushPick target of kind PAINT | HOST
 *   (PAINT: with its db `row`)
 * @param {object} params.template - the armed (painting) template
 * @param {string} [params.projectId]
 * @param {string} params.scopeId
 * @param {boolean} [params.createAsAnnotation]
 * @param {object} [params.templateProps] - the armed newAnnotation draft
 * @param {object[]} [params.baseMaps] - resolved base maps (2D commit host)
 * @param {Function} [params.createAnnotationFn] - useCreateAnnotation's fn
 * @returns {Promise<{action: string|null, id: string|null, deletedIds: string[], annotationIds?: string[], reason?: string}>}
 *   paintMeshPartService result (db guard errors are thrown), or
 *   {action: "CREATED_2D" | "CREATED_MESH", annotationIds}.
 */
export default async function commitMeshBrushTargetService({
  editor,
  target,
  template,
  projectId,
  scopeId,
  createAsAnnotation = false,
  templateProps = null,
  baseMaps = [],
  createAnnotationFn = null,
}) {
  const sceneManager = editor?.sceneManager;
  const imagesManager = sceneManager?.imagesManager;
  const refuse = (reason) => ({
    action: null,
    id: null,
    deletedIds: [],
    reason,
  });
  if (!target || !imagesManager) return refuse("NO_TARGET");

  if (target.kind === "PAINT") {
    const row = target.row;
    if (!row) return refuse("NO_TARGET");
    return paintMeshPartService({
      candidate: {
        partType: row.partType,
        hostAnnotationId: row.hostAnnotationId,
        baseMapId: row.baseMapId,
        geometry: row.geometry,
        geomHash: row.sync?.geomHash ?? null,
      },
      template,
      metrics: getMeshPaintMetrics(imagesManager.baseMapsMap?.[row.baseMapId]),
      projectId,
      scopeId,
    });
  }

  if (target.kind !== "HOST") return refuse("NO_TARGET");
  const { partType, hostId, baseMapId } = target;

  const isDense = Boolean(target.dense);
  if (!isDense)
    await ensureUnshrunkHostObject({ editor, annotationId: hostId });

  const annotationsManager = sceneManager.annotationsManager;
  const root = annotationsManager?.annotationsObjectsMap?.[hostId] ?? null;
  const group = imagesManager.getGroup?.(baseMapId);
  const baseMap = imagesManager.baseMapsMap?.[baseMapId];
  const metrics = getMeshPaintMetrics(baseMap) ?? target.metrics;

  let localGeometry = target.localGeometry;
  let geomHash = null;
  if (!isDense) {
    try {
      const data =
        root && group
          ? getHostPartData({
              root,
              group,
              source: annotationsManager.getAnnotationSource?.(hostId),
              baseMap,
            })
          : null;
      const match = data
        ? matchPaintPartToIndex(partType, localGeometry, data.getIndex(), {
            allowFar: false,
          })
        : null;
      if (match) {
        localGeometry = match.geometry;
        geomHash = data.hash;
      }
    } catch (error) {
      // The picked geometry stands (the next re-sync decides).
      console.warn("[meshBrush] re-detection failed", hostId, error);
    }
  }

  if (createAsAnnotation || isDense) {
    const host = await db.annotations.get(hostId);
    if (!host || host.deletedAt) return refuse("HOST_DELETED");
    const created = (action, annotationIds) => ({
      action,
      id: annotationIds[0] ?? null,
      annotationIds,
      deletedIds: [],
    });
    const result = await commitMeshBrush2dService({
      editor,
      partType,
      hostId,
      baseMapId,
      localGeometry,
      host,
      template,
      templateProps,
      baseMaps,
      projectId: projectId ?? host.projectId ?? null,
      createAnnotationFn,
    });
    if (result.status === BRUSH_2D_STATUS.CREATED) {
      return created("CREATED_2D", result.annotationIds);
    }
    if (result.status === BRUSH_2D_STATUS.NO_GROUND) {
      return refuse("NO_GROUND");
    }
    if (result.status === BRUSH_2D_STATUS.DUPLICATE) {
      return refuse("DUPLICATE");
    }
    // FALLBACK (no plan encoding): a facet becomes an annotation mesh.
    if (partType === MESH_PAINT_PART_TYPES.FACE) {
      const meshResult = await commitMeshBrushMeshService({
        editor,
        hostId,
        baseMapId,
        localGeometry,
        host,
        template,
        templateProps,
        projectId: projectId ?? host.projectId ?? null,
        scopeId,
        createAnnotationFn,
      });
      if (meshResult.status === BRUSH_MESH_STATUS.CREATED) {
        return created("CREATED_MESH", meshResult.annotationIds);
      }
      if (meshResult.status === BRUSH_MESH_STATUS.DUPLICATE) {
        return refuse("DUPLICATE");
      }
    }
    // Still nothing: the paint row below — never on a dense host.
    if (isDense) return refuse("NO_GEOMETRY");
  }

  const geometry = localGeometryToPaint(partType, localGeometry, metrics);
  if (!geometry) return refuse("NO_GEOMETRY");
  return paintMeshPartService({
    candidate: {
      partType,
      hostAnnotationId: hostId,
      baseMapId,
      geometry,
      geomHash,
    },
    template,
    metrics,
    projectId,
    scopeId,
  });
}
