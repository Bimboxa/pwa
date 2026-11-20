import db from "App/db/db";

import getBaseMapRenderScale from "Features/baseMaps/js/getBaseMapRenderScale";
import getHostsCutByAnnotationAsync from "Features/threedEditor/js/utilsAnnotationsManager/getHostsCutByAnnotationAsync";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { getShape3DKey } from "../constants/shape3DConfig";
import getAnnotationPropsFromAnnotationTemplateProps from "../utils/getAnnotationPropsFromAnnotationTemplateProps";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import isVolumeCutter, { CUTTER_TYPES } from "../utils/isVolumeCutter";
import resolveRowsAgainstOwnBaseMap from "../utils/resolveRowsAgainstOwnBaseMap";
import addAnnotationSubtractions from "./addAnnotationSubtractions";

// Marker of the relAnnotationSubtractions rows created by this sync: only
// those are removed when the contact is lost (a relation set by hand with
// « Soustraire » is never touched).
export const SUBTRACTION_ORIGIN_CONTACT = "CONTACT";

// What can be carved (same types as « Soustraire », plus 3D meshes).
const HOST_TYPES = ["POLYGON", "RECTANGLE", "POLYLINE", "STRIP"];

// Line refs a light headless resolution leaves unresolved: a host whose solid
// depends on them is only testable from the 3D scene's resolved source.
const UNRESOLVED_LINE_KEYS = [
  "profileLines",
  "guideLines",
  "isoHeightLines",
  "heightCuts",
  "heightCutFaces",
];

const EMPTY_RESULT = { addedCount: 0, removedCount: 0, cutterIds: [] };

const isLive = (row) => Boolean(row) && !row.deletedAt;

const hasItems = (value) => Array.isArray(value) && value.length > 0;

// Whether a light-resolved row (points + holes only) builds the same solid as
// the fully resolved annotation of the pipeline.
function isLightResolvable(row) {
  if (UNRESOLVED_LINE_KEYS.some((key) => hasItems(row[key]))) return false;
  const shapeKey = getShape3DKey(row.shape3D);
  return shapeKey !== "REVOLUTION" && shapeKey !== "EXTRUSION_PROFILE";
}

// The template merge reads the scale through the BaseMap instance API.
const asBaseMapForMerge = (baseMap) =>
  baseMap?.getMeterByPx
    ? baseMap
    : { ...baseMap, getMeterByPx: () => getBaseMapRenderScale(baseMap) };

/**
 * « Soustraire au contact »: keeps the subtraction relations of the given
 * annotations in sync with what they really touch in 3D.
 *
 * For every annotation of `annotationIds` whose effective flag is on
 * (`annotation.subtractOnContact || template.subtractOnContact`) and that
 * builds a volume:
 *  - each annotation of the same project / scope it cuts into (any base map,
 *    exact 3D boolean — getHostsCutByAnnotationAsync) gets a relation
 *    host → annotation, tagged `origin: "CONTACT"`;
 *  - the "CONTACT" relations whose host is no longer cut are soft-deleted.
 * Relations created by hand are never removed.
 *
 * Headless and derived: the writes push no undo entry (undoing the edit that
 * triggered the sync re-runs it, see requestSubtractOnContactSync). Returns
 * immediately when no annotation carries the flag.
 *
 * Hosts are resolved from the live 3D scene when it holds an up-to-date
 * source (full pipeline resolution), else from the rows (points + holes):
 * in that fallback, hosts whose solid needs more (profile / guide / iso
 * lines, height cuts, REVOLUTION, EXTRUSION_PROFILE) are skipped.
 *
 * @param {Object} args
 * @param {string[]} args.annotationIds
 * @param {Function} [args.isCancelled]
 * @returns {Promise<{addedCount: number, removedCount: number, cutterIds: string[]}>}
 */
export default async function syncSubtractOnContactService({
  annotationIds,
  isCancelled,
}) {
  const ids = [...new Set((annotationIds ?? []).filter(Boolean))];
  if (ids.length === 0) return EMPTY_RESULT;

  // -- 1. the flagged cutters (cheap exit when the option is not used) --

  const rows = (await db.annotations.bulkGet(ids)).filter(isLive);
  if (rows.length === 0) return EMPTY_RESULT;

  const templateById = new Map();
  const loadTemplates = async (templateIds) => {
    const missing = [...new Set(templateIds)].filter(
      (id) => id && !templateById.has(id)
    );
    if (missing.length === 0) return;
    const found = await db.annotationTemplates.bulkGet(missing);
    missing.forEach((id, i) =>
      templateById.set(id, isLive(found[i]) ? found[i] : null)
    );
  };
  await loadTemplates(rows.map((r) => r.annotationTemplateId));

  const isFlagged = (row) =>
    row.subtractOnContact === true ||
    templateById.get(row.annotationTemplateId)?.subtractOnContact === true;

  const cutterRows = rows.filter(
    (r) =>
      isFlagged(r) &&
      r.baseMapId &&
      r.projectId &&
      CUTTER_TYPES.includes(r.type) &&
      !r.isOpening &&
      !r.isMeshCell
  );
  if (cutterRows.length === 0) return EMPTY_RESULT;

  // -- 2. project context --

  const projectIds = [...new Set(cutterRows.map((r) => r.projectId))];
  const [projectRows, baseMapRows, listingRows, relRows] = await Promise.all([
    db.annotations.where("projectId").anyOf(projectIds).toArray(),
    db.baseMaps.where("projectId").anyOf(projectIds).toArray(),
    db.listings.where("projectId").anyOf(projectIds).toArray(),
    db.relAnnotationSubtractions.where("projectId").anyOf(projectIds).toArray(),
  ]);
  if (isCancelled?.()) return EMPTY_RESULT;

  const baseMapById = {};
  for (const bm of baseMapRows) if (isLive(bm)) baseMapById[bm.id] = bm;

  const scopeIdByListingId = new Map();
  for (const l of listingRows) scopeIdByListingId.set(l.id, l.scopeId ?? null);
  const getScopeId = (row) =>
    row.scopeId ?? scopeIdByListingId.get(row.listingId) ?? null;

  const liveRels = relRows.filter(isLive);
  const relsByTarget = new Map();
  const targetIdsBySource = new Map();
  for (const rel of liveRels) {
    if (!relsByTarget.has(rel.targetAnnotationId))
      relsByTarget.set(rel.targetAnnotationId, []);
    relsByTarget.get(rel.targetAnnotationId).push(rel);
    if (!targetIdsBySource.has(rel.sourceAnnotationId))
      targetIdsBySource.set(rel.sourceAnnotationId, new Set());
    targetIdsBySource.get(rel.sourceAnnotationId).add(rel.targetAnnotationId);
  }

  const hostRows = projectRows.filter(
    (r) =>
      isLive(r) &&
      baseMapById[r.baseMapId] &&
      (HOST_TYPES.includes(r.type) || r.isMesh3d) &&
      !r.isOpening &&
      !r.isMeshCell
  );
  await loadTemplates(hostRows.map((r) => r.annotationTemplateId));

  // -- 3. resolution (pixels in each row's own base map + template fields) --

  const editor = getActiveThreedEditor();
  const annotationsManager = editor?.sceneManager?.annotationsManager;
  const buildOptions = annotationsManager?.getBuildOptions?.() ?? undefined;

  // A scene source is the fully resolved annotation of the pipeline: use it
  // while it reflects the stored row.
  const getSceneSource = (row) => {
    const source = annotationsManager?.getAnnotationSource?.(row.id);
    if (!source || source.baseMapId !== row.baseMapId) return null;
    if (source.updatedAt !== row.updatedAt) return null;
    return source;
  };

  const lightById = await resolveRowsAgainstOwnBaseMap(
    [...cutterRows, ...hostRows.filter((r) => !getSceneSource(r))],
    baseMapById,
    { withCuts: true }
  );
  if (isCancelled?.()) return EMPTY_RESULT;

  const withTemplateFields = (row) => {
    const template = templateById.get(row.annotationTemplateId);
    if (!template) return row;
    return getAnnotationPropsFromAnnotationTemplateProps(
      row,
      getAnnotationTemplateProps(template),
      asBaseMapForMerge(baseMapById[row.baseMapId])
    );
  };

  const resolveLight = (row) => {
    const resolved = lightById.get(row.id);
    return resolved ? withTemplateFields(resolved) : null;
  };

  const resolveHost = (row) => {
    const source = getSceneSource(row);
    if (source) return source;
    if (!isLightResolvable(row)) return null;
    return resolveLight(row);
  };

  // -- 4. detection + diff --

  const pairsToAdd = [];
  const relIdsToRemove = [];
  const syncedCutterIds = [];

  for (const cutterRow of cutterRows) {
    if (isCancelled?.()) return EMPTY_RESULT;
    // The cutter was just written: always from the rows, never from a scene
    // source that may lag behind the edit.
    const cutter = isLightResolvable(cutterRow)
      ? resolveLight(cutterRow)
      : getSceneSource(cutterRow);
    if (!cutter || !isVolumeCutter(cutter)) continue;

    const cutterScopeId = getScopeId(cutterRow);
    const carvedByCutter = targetIdsBySource.get(cutterRow.id);

    const hosts = hostRows
      .filter((r) => {
        if (r.id === cutterRow.id || r.projectId !== cutterRow.projectId)
          return false;
        // Two « soustraire au contact » annotations never carve each other.
        if (isFlagged(r)) return false;
        // Never close a cycle: an annotation the cutter is carved out of.
        if (carvedByCutter?.has(r.id)) return false;
        // Another scope of the project (e.g. a duplicated scope lying at the
        // same place) is out of reach.
        const scopeId = getScopeId(r);
        return !cutterScopeId || !scopeId || scopeId === cutterScopeId;
      })
      .map(resolveHost)
      .filter(Boolean);

    const hits = await getHostsCutByAnnotationAsync({
      cutter,
      hosts,
      baseMapsById: baseMapById,
      buildOptions,
      isCancelled,
    });
    if (isCancelled?.()) return EMPTY_RESULT;

    const touchedHostIds = new Set(hits.map((hit) => hit.annotation.id));
    const testedHostIds = new Set(hosts.map((host) => host.id));
    const existingRels = relsByTarget.get(cutterRow.id) ?? [];
    const existingHostIds = new Set(
      existingRels.map((rel) => rel.sourceAnnotationId)
    );

    for (const hostId of touchedHostIds) {
      if (existingHostIds.has(hostId)) continue;
      pairsToAdd.push({
        sourceAnnotationId: hostId,
        targetAnnotationId: cutterRow.id,
        origin: SUBTRACTION_ORIGIN_CONTACT,
      });
    }
    for (const rel of existingRels) {
      if (rel.origin !== SUBTRACTION_ORIGIN_CONTACT) continue;
      // A host that could not be tested (unresolvable here) keeps its
      // relation: only a NEGATIVE test removes it.
      if (!testedHostIds.has(rel.sourceAnnotationId)) continue;
      if (!touchedHostIds.has(rel.sourceAnnotationId))
        relIdsToRemove.push(rel.id);
    }
    syncedCutterIds.push(cutterRow.id);
  }

  // -- 5. writes (derived: no undo entry) --

  let addedCount = 0;
  if (pairsToAdd.length > 0) {
    const byProject = new Map();
    for (const pair of pairsToAdd) {
      const projectId = cutterRows.find(
        (r) => r.id === pair.targetAnnotationId
      ).projectId;
      if (!byProject.has(projectId)) byProject.set(projectId, []);
      byProject.get(projectId).push(pair);
    }
    for (const [projectId, pairs] of byProject) {
      const { addedIds } = await addAnnotationSubtractions({
        projectId,
        pairs,
        skipUndo: true,
      });
      addedCount += addedIds.length;
    }
  }
  if (relIdsToRemove.length > 0) {
    await db.transaction("rw", db.relAnnotationSubtractions, async (tx) => {
      tx.skipUndo = true;
      await db.relAnnotationSubtractions.bulkDelete(relIdsToRemove);
    });
  }

  return {
    addedCount,
    removedCount: relIdsToRemove.length,
    cutterIds: syncedCutterIds,
  };
}
