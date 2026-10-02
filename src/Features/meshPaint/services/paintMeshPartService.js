import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { MESH_PAINT_SYNC_STATES } from "Features/meshPaint/constants/meshPaintConstants";
import { getMeshPaintPartTypeForTemplate } from "Features/meshPaint/utils/meshBrushTools";
import findMeshPaintMatches from "Features/meshPaint/utils/findMeshPaintMatches";
import planPaintToggle from "Features/meshPaint/utils/planPaintToggle";

const isLive = (row) => row && !row.deletedAt;

/**
 * Commit of one « Pinceau » click: links the template to the picked facet
 * side / edge, or toggles / replaces the paint already there.
 *
 * One template per part (matched at the BASE MAP level, any host — the
 * corner edge shared by two walls is one edge): a match carrying the same
 * template → REMOVED (every match deleted, nothing added); otherwise every
 * match is deleted and the new row added (REPLACED when there was a match,
 * ADDED otherwise). One undo step, one transaction.
 *
 * Matches are searched among the paints of the SAME scope (a duplicated
 * scope paints coincident hosts on the same base map) whose host and
 * template are still live; provisional copies (awaiting their first re-sync)
 * are ignored.
 *
 * Guard failures are returned, not thrown ({action: null, reason}); db
 * guard errors (ReadOnlyScopeError, LinkedListingReadOnlyError) are thrown.
 *
 * @param {Object} params
 * @param {{partType: "FACE"|"EDGE", hostAnnotationId: string, baseMapId: string, geometry: Object, geomHash?: string|null}} params.candidate
 *   geometry in the STORED form (meshPaintFrame).
 * @param {Object} params.template - the armed (painting) annotation template.
 * @param {{imageWidth: number, imageHeight: number, meterByPx: number}} params.metrics
 *   frame metrics of candidate.baseMapId (findMeshPaintMatches).
 * @param {string} [params.projectId] - defaults to the host's projectId.
 * @param {string} params.scopeId - selected scope.
 * @returns {Promise<{action: "ADDED"|"REMOVED"|"REPLACED"|null, id: string|null, deletedIds: string[], reason?: string}>}
 */
export default async function paintMeshPartService({
  candidate,
  template,
  metrics,
  projectId,
  scopeId,
}) {
  const refuse = (reason) => ({
    action: null,
    id: null,
    deletedIds: [],
    reason,
  });

  // guards

  if (!candidate?.hostAnnotationId || !candidate?.baseMapId) {
    return refuse("NO_CANDIDATE");
  }
  if (!candidate.geometry) return refuse("NO_GEOMETRY");
  if (!template?.id) return refuse("NO_TEMPLATE");
  // Without the frame metrics no match can be found: a re-click would stack
  // a duplicate instead of removing the paint.
  if (!metrics) return refuse("NO_METRICS");

  const [liveTemplate, host] = await Promise.all([
    db.annotationTemplates.get(template.id),
    db.annotations.get(candidate.hostAnnotationId),
  ]);
  if (!isLive(liveTemplate)) return refuse("TEMPLATE_DELETED");
  if (getMeshPaintPartTypeForTemplate(liveTemplate) !== candidate.partType) {
    return refuse("PART_TYPE_MISMATCH");
  }
  if (!isLive(host)) return refuse("HOST_DELETED");
  if (host.baseMapId && host.baseMapId !== candidate.baseMapId) {
    return refuse("BASE_MAP_MISMATCH");
  }

  // matches (same scope, effective rows only)

  const baseMapRows = (
    await db.meshPaints.where("baseMapId").equals(candidate.baseMapId).toArray()
  ).filter(
    (r) =>
      isLive(r) &&
      (r.scopeId ?? null) === (scopeId ?? null) &&
      !r.sync?.provisional
  );

  const rawMatches = baseMapRows.length
    ? findMeshPaintMatches({ candidate, rows: baseMapRows, metrics })
    : [];
  const matches = await keepEffectiveRows(rawMatches);

  const { action, deleteIds, add } = planPaintToggle({
    matches,
    templateId: liveTemplate.id,
  });

  // write

  const now = new Date().toISOString();
  const row = add
    ? {
        id: nanoid(),
        projectId: projectId ?? host.projectId ?? null,
        scopeId: scopeId ?? null,
        listingId: liveTemplate.listingId,
        annotationTemplateId: liveTemplate.id,
        hostAnnotationId: candidate.hostAnnotationId,
        baseMapId: candidate.baseMapId,
        partType: candidate.partType,
        geometry: candidate.geometry,
        paintedAt: now,
        sync: {
          state: MESH_PAINT_SYNC_STATES.OK,
          geomHash: candidate.geomHash ?? null,
          syncedAt: now,
        },
      }
    : null;

  await withUndoGroup(() =>
    db.transaction("rw", db.meshPaints, async () => {
      if (deleteIds.length > 0) await db.meshPaints.bulkDelete(deleteIds);
      if (row) await db.meshPaints.add(row);
    })
  );

  return { action, id: row?.id ?? null, deletedIds: deleteIds };
}

// Matches the user can see (same rule as resolveMeshPaints): host and
// template still live, template still painting this part type. A paint left
// on a deleted host (deletion path without cascade) must not swallow the
// click.
async function keepEffectiveRows(rows) {
  if (!rows?.length) return [];
  const hostIds = [...new Set(rows.map((r) => r.hostAnnotationId))];
  const templateIds = [...new Set(rows.map((r) => r.annotationTemplateId))];
  const [hosts, templates] = await Promise.all([
    db.annotations.bulkGet(hostIds),
    db.annotationTemplates.bulkGet(templateIds),
  ]);
  const liveHostIds = new Set(hosts.filter(isLive).map((h) => h.id));
  const templateById = new Map(templates.filter(isLive).map((t) => [t.id, t]));
  return rows.filter((r) => {
    if (!liveHostIds.has(r.hostAnnotationId)) return false;
    const template = templateById.get(r.annotationTemplateId);
    return (
      Boolean(template) &&
      getMeshPaintPartTypeForTemplate(template) === r.partType
    );
  });
}
