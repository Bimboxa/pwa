import db from "App/db/db";

import commitMeshBrush2dService, {
  BRUSH_2D_STATUS,
} from "Features/meshPaint/services/commitMeshBrush2dService";
import ensureUnshrunkHostObject from "Features/meshPaint/services/ensureUnshrunkHostObject";
import paintMeshPartService from "Features/meshPaint/services/paintMeshPartService";
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
 * - HOST with `create2dIfPossible` (drawing helper switch « Créer une
 *   annotation 2D si possible »): the re-detected part is first offered to
 *   commitMeshBrush2dService — CREATED → action "CREATED_2D" (no paint row);
 *   NO_GROUND (thick wall facet without a floor polygon at its foot) →
 *   nothing written, reason "NO_GROUND" (the caller shows a toaster);
 *   FALLBACK → the paint row as usual.
 *
 * @param {object} params
 * @param {object} params.editor - the active ThreedEditor
 * @param {object} params.target - meshBrushPick target of kind PAINT | HOST
 *   (PAINT: with its db `row`)
 * @param {object} params.template - the armed (painting) template
 * @param {string} [params.projectId]
 * @param {string} params.scopeId
 * @param {boolean} [params.create2dIfPossible]
 * @param {object} [params.templateProps] - the armed newAnnotation draft
 * @param {object[]} [params.baseMaps] - resolved base maps (2D commit host)
 * @param {Function} [params.createAnnotationFn] - useCreateAnnotation's fn
 * @returns {Promise<{action: string|null, id: string|null, deletedIds: string[], annotationIds?: string[], reason?: string}>}
 *   paintMeshPartService result (db guard errors are thrown), or
 *   {action: "CREATED_2D", annotationIds}.
 */
export default async function commitMeshBrushTargetService({
  editor,
  target,
  template,
  projectId,
  scopeId,
  create2dIfPossible = false,
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

  await ensureUnshrunkHostObject({ editor, annotationId: hostId });

  const annotationsManager = sceneManager.annotationsManager;
  const root = annotationsManager?.annotationsObjectsMap?.[hostId] ?? null;
  const group = imagesManager.getGroup?.(baseMapId);
  const baseMap = imagesManager.baseMapsMap?.[baseMapId];
  const metrics = getMeshPaintMetrics(baseMap) ?? target.metrics;

  let localGeometry = target.localGeometry;
  let geomHash = null;
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

  if (create2dIfPossible) {
    const host = await db.annotations.get(hostId);
    if (!host || host.deletedAt) return refuse("HOST_DELETED");
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
      return {
        action: "CREATED_2D",
        id: result.annotationIds[0] ?? null,
        annotationIds: result.annotationIds,
        deletedIds: [],
      };
    }
    if (result.status === BRUSH_2D_STATUS.NO_GROUND) {
      return refuse("NO_GROUND");
    }
    // FALLBACK: the paint row below.
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
