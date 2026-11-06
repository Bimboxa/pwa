import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";
import { getHostPartData } from "Features/meshPaint/js/buildHostPartIndexFromObject";
import commitMeshBrush2dService, {
  BRUSH_2D_STATUS,
} from "Features/meshPaint/services/commitMeshBrush2dService";
import commitMeshBrushMeshService, {
  BRUSH_MESH_STATUS,
} from "Features/meshPaint/services/commitMeshBrushMeshService";
import ensureUnshrunkHostObject from "Features/meshPaint/services/ensureUnshrunkHostObject";
import getMeshBrushAllPartsPlan from "Features/meshPaint/services/getMeshBrushAllPartsPlan";
import {
  buildMeshPaintRow,
  getScopePaintRowsOfBaseMap,
  keepEffectiveRows,
} from "Features/meshPaint/services/paintMeshPartService";
import { canTemplatePaint } from "Features/meshPaint/utils/meshBrushTools";
import { matchPaintPartToIndex } from "Features/meshPaint/utils/planPaintResync";

const PART_TYPES = Object.values(MESH_PAINT_PART_TYPES);

const isLive = (row) => row && !row.deletedAt;

/**
 * Commit of one « Pinceau » click with « Peindre toutes les faces de
 * l'annotation » / « Peindre toutes les arêtes de l'annotation » on (FACE /
 * EDGE targets of meshBrushPick), ONE undo step:
 *
 * - the clicked part carries the armed template → every paint of that part
 *   type and of that template on the host is removed (action "REMOVED");
 * - otherwise the clicked part is painted (the paint of another template on
 *   it is replaced) together with every other BARE part of that type of the
 *   host (planPaintAllParts: one side per face, no duplicate) — one
 *   db.meshPaints row per part, written in one transaction (action "ADDED" |
 *   "REPLACED"). A HOST target is first rebuilt without its anti-aliasing
 *   shrink and its parts are read on the rebuilt object, like a plain click
 *   (commitMeshBrushTargetService).
 * - `createAsAnnotation`: every bare part first goes through
 *   commitMeshBrush2dService, like a plain click — a 2D annotation when the
 *   plan can hold it (no paint row), skipped when it has no floor
 *   (NO_GROUND) or already exists (DUPLICATE); a facet without plan encoding
 *   becomes an annotation mesh (commitMeshBrushMeshService, skipped when it
 *   already exists); a paint row otherwise.
 *
 * Guard failures are returned ({action: null, reason}); db guard errors
 * (ReadOnlyScopeError, LinkedListingReadOnlyError) are thrown.
 *
 * @param {object} params
 * @param {object} params.editor - the active ThreedEditor
 * @param {object} params.target - meshBrushPick target, kind PAINT (with its
 *   db `row`) | HOST; its partType is the part type painted
 * @param {object} params.template - the armed (painting) template
 * @param {string} [params.projectId]
 * @param {string} params.scopeId
 * @param {number} [params.smoothAngleDeg] - « Sélection de face » angle
 * @param {boolean} [params.createAsAnnotation]
 * @param {object} [params.templateProps] - the armed newAnnotation draft
 * @param {object[]} [params.baseMaps] - resolved base maps (2D commit host)
 * @param {Function} [params.createAnnotationFn] - useCreateAnnotation's fn
 * @returns {Promise<{action: "ADDED"|"REPLACED"|"REMOVED"|null,
 *   paintIds: string[], annotationIds: string[], deletedIds: string[],
 *   skippedCount: number, reason?: string}>} skippedCount: bare parts the
 *   annotation commit refused (NO_GROUND / DUPLICATE).
 */
export default async function commitMeshBrushAllPartsService({
  editor,
  target,
  template,
  projectId,
  scopeId,
  smoothAngleDeg = 0,
  createAsAnnotation = false,
  templateProps = null,
  baseMaps = [],
  createAnnotationFn = null,
}) {
  const sceneManager = editor?.sceneManager;
  const done = (action, extra = {}) => ({
    action,
    paintIds: [],
    annotationIds: [],
    deletedIds: [],
    skippedCount: 0,
    ...extra,
  });
  const refuse = (reason) => done(null, { reason });

  // guards

  const isPaint = target?.kind === "PAINT";
  if (!sceneManager?.imagesManager || !target) return refuse("NO_TARGET");
  if (!isPaint && target.kind !== "HOST") return refuse("NO_TARGET");
  const partType = target.partType;
  if (!PART_TYPES.includes(partType)) return refuse("NO_PART_TYPE");
  const hostId = isPaint ? target.row?.hostAnnotationId : target.hostId;
  const baseMapId = isPaint ? target.row?.baseMapId : target.baseMapId;
  if (!hostId || !baseMapId) return refuse("NO_TARGET");
  if (!template?.id) return refuse("NO_TEMPLATE");

  const [liveTemplate, host] = await Promise.all([
    db.annotationTemplates.get(template.id),
    db.annotations.get(hostId),
  ]);
  if (!isLive(liveTemplate)) return refuse("TEMPLATE_DELETED");
  if (!canTemplatePaint(liveTemplate)) return refuse("TEMPLATE_CANNOT_PAINT");
  if (!isLive(host)) return refuse("HOST_DELETED");
  if (host.baseMapId && host.baseMapId !== baseMapId) {
    return refuse("BASE_MAP_MISMATCH");
  }

  // plan (fresh rows; a HOST is read un-shrunk)

  const rows = await keepEffectiveRows(
    await getScopePaintRowsOfBaseMap({ baseMapId, scopeId })
  );
  const getPlan = (clickedPart) =>
    getMeshBrushAllPartsPlan({
      sceneManager,
      partType,
      hostId,
      baseMapId,
      clickedPart,
      viewDir: target.viewDir ?? null,
      rows,
      templateId: liveTemplate.id,
      smoothAngleDeg,
    });

  let plan = getPlan(target.localGeometry);
  if (!plan) return refuse("NO_METRICS");

  if (plan.action !== "REMOVED" && !isPaint) {
    await ensureUnshrunkHostObject({ editor, annotationId: hostId });
    plan = getPlan(redetectClickedPart({ sceneManager, target })) ?? plan;
  }
  if (plan.tooMany) return refuse("TOO_MANY_PARTS");
  if (!plan.action) return refuse("NO_GEOMETRY");

  // REMOVED: every part of that type and of the armed template on the host

  if (plan.action === "REMOVED") {
    await withUndoGroup(() => db.meshPaints.bulkDelete(plan.deleteIds));
    return done("REMOVED", { deletedIds: plan.deleteIds });
  }

  // ADDED / REPLACED

  const now = new Date().toISOString();
  const toRow = (item, isClicked) =>
    buildMeshPaintRow({
      candidate: {
        partType,
        hostAnnotationId: hostId,
        baseMapId,
        geometry: item.geometry,
        geomHash: !isClicked || plan.isClickedFromIndex ? plan.hash : null,
      },
      template: liveTemplate,
      host,
      projectId,
      scopeId,
      now,
    });

  const annotationIds = [];
  let skippedCount = 0;
  let newRows = [];

  await withUndoGroup(async () => {
    const paintItems = [];
    for (let i = 0; i < plan.add.length; i++) {
      const item = plan.add[i];
      const isClicked = i === 0;
      // Only a bare part becomes a 2D annotation: the clicked one keeps the
      // paint semantics when it replaces a paint.
      const isBare = !isClicked || plan.action === "ADDED";
      if (createAsAnnotation && !isPaint && isBare) {
        const result = await commitMeshBrush2dService({
          editor,
          partType,
          hostId,
          baseMapId,
          localGeometry: item.localGeometry,
          host,
          template: liveTemplate,
          templateProps,
          baseMaps,
          projectId: projectId ?? host.projectId ?? null,
          createAnnotationFn,
        });
        if (result.status === BRUSH_2D_STATUS.CREATED) {
          annotationIds.push(...result.annotationIds);
          continue;
        }
        if (result.status !== BRUSH_2D_STATUS.FALLBACK) {
          skippedCount += 1;
          continue;
        }
        // No plan encoding: a facet becomes an annotation mesh.
        if (partType === MESH_PAINT_PART_TYPES.FACE) {
          const meshResult = await commitMeshBrushMeshService({
            editor,
            hostId,
            baseMapId,
            localGeometry: item.localGeometry,
            host,
            template: liveTemplate,
            templateProps,
            projectId: projectId ?? host.projectId ?? null,
            scopeId,
            createAnnotationFn,
          });
          if (meshResult.status === BRUSH_MESH_STATUS.CREATED) {
            annotationIds.push(...meshResult.annotationIds);
            continue;
          }
          if (meshResult.status === BRUSH_MESH_STATUS.DUPLICATE) {
            skippedCount += 1;
            continue;
          }
        }
      }
      paintItems.push({ item, isClicked });
    }

    newRows = paintItems.map(({ item, isClicked }) => toRow(item, isClicked));
    await db.transaction("rw", db.meshPaints, async () => {
      if (plan.deleteIds.length > 0) {
        await db.meshPaints.bulkDelete(plan.deleteIds);
      }
      if (newRows.length > 0) await db.meshPaints.bulkAdd(newRows);
    });
  });

  return done(plan.action, {
    paintIds: newRows.map((row) => row.id),
    annotationIds,
    deletedIds: plan.deleteIds,
    skippedCount,
  });
}

// The clicked part found again on the host's rebuilt (un-shrunk) object —
// Stage 1 of the re-sync matching, like a plain click (an edge comes back
// with the facets it borders); the picked geometry stands when it is not
// found.
function redetectClickedPart({ sceneManager, target }) {
  const { partType, hostId, baseMapId, localGeometry } = target;
  try {
    const imagesManager = sceneManager.imagesManager;
    const annotationsManager = sceneManager.annotationsManager;
    const root = annotationsManager?.annotationsObjectsMap?.[hostId] ?? null;
    const group = imagesManager.getGroup?.(baseMapId);
    const data =
      root && group
        ? getHostPartData({
            root,
            group,
            source: annotationsManager.getAnnotationSource?.(hostId),
            baseMap: imagesManager.baseMapsMap?.[baseMapId],
          })
        : null;
    const match = data
      ? matchPaintPartToIndex(partType, localGeometry, data.getIndex(), {
          allowFar: false,
        })
      : null;
    return match?.geometry ?? localGeometry;
  } catch (error) {
    console.warn("[meshBrush] re-detection failed", hostId, error);
    return localGeometry;
  }
}
