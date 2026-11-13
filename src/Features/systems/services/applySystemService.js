import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getBaseMapRowFrame from "Features/pathArray/utils/getBaseMapRowFrame";

import collectSystemChildren from "./collectSystemChildren";
import { deleteSystemChildRowsInTx } from "./deleteSystemChildrenService";
import {
  SYSTEM_PROCEDURE_TYPE,
  SYSTEM_ROLE_SOURCE,
} from "../constants/systemConstants";
import getSystemEffectiveSource from "../utils/getSystemEffectiveSource";
import getSystemParams from "../utils/getSystemParams";
import getSystemSignature from "../utils/getSystemSignature";

const COORD_EPS = 1e-9;

function parseMappingCategory(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const parts = entry.split(":");
    if (parts.length !== 2) return null;
    const [nomenclatureKey, categoryKey] = parts.map((s) => s.trim());
    if (!nomenclatureKey || !categoryKey) return null;
    return { nomenclatureKey, categoryKey };
  }
  if (entry.nomenclatureKey && entry.categoryKey) return entry;
  return null;
}

const sameValue = (a, b) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Only the keys whose value actually differs from the stored row.
function diffChanges(existing, next) {
  const changes = {};
  for (const [key, value] of Object.entries(next)) {
    if (!sameValue(existing[key], value)) changes[key] = value;
  }
  return changes;
}

// The system procedure of a listing, from the registry
// (appConfig.systemProcedures).
export function getSystemProcedure(listing, procedures) {
  const key = listing?.system?.procedureKey;
  if (!key) return null;
  return (
    (procedures ?? []).find(
      (p) => p.key === key && p.type === SYSTEM_PROCEDURE_TYPE
    ) ?? null
  );
}

async function loadGenerate(procedure) {
  if (typeof procedure?.generate !== "function") return null;
  const mod = await procedure.generate();
  const generate = mod?.default ?? mod;
  return typeof generate === "function" ? generate : null;
}

/**
 * (Re)generates the annotations of a system instance from its source
 * annotation (see constants/systemConstants.js).
 *
 * The procedure of the system listing (`generate`, a pure function) returns
 * the elements to build:
 *
 *   generate({ source, points, closeLine, meterByPx, params })
 *     → [{ key, role, type, points, closeLine?, props }]
 *
 *   - `source`: the source row with its template-locked fields applied
 *     (height in m, offsetZ in m, strokeWidth + strokeWidthUnit);
 *   - `points`: the source vertices in PIXELS ({ x, y, type }), a copy;
 *   - `key`: stable id of the element inside the instance (e.g.
 *     "PLATFORM:3") — existing rows are RECONCILED by key (updated in place,
 *     the others deleted) rather than recreated;
 *   - `role`: `systemRole` of the template of the system listing the element
 *     is built from (an element whose template is missing is skipped);
 *   - `points`: the element vertices in pixels; `props`: annotation fields
 *     (height, offsetZ, strokeWidth, …) laid over the template props.
 *
 * Every element is a regular annotation row with its own db.points rows
 * (normalized — docs/annotations/POINTS_STORAGE.md), tagged
 * `systemSourceAnnotationId` + `systemElementKey`. Everything lands in one
 * transaction without undo entry (tx.skipUndo): the rows are derived, undoing
 * the source edit re-derives them (useSystemsSync). The signature the rows
 * were generated from is stored on the source (`systemApplied`).
 *
 * Returns { count } or null when the annotation is not a system source.
 */
export default async function applySystemService({
  sourceId,
  procedures,
  dispatch,
}) {
  const source = await db.annotations.get(sourceId);
  if (!source || source.deletedAt || !source.listingId) return null;

  const listing = await db.listings.get(source.listingId);
  if (!listing?.system || listing.deletedAt) return null;

  const refs = source.points ?? [];
  const [pointRows, baseMap, templateRows, existing] = await Promise.all([
    db.points.bulkGet(refs.map((p) => p?.id)),
    source.baseMapId ? db.baseMaps.get(source.baseMapId) : null,
    db.annotationTemplates.where("listingId").equals(listing.id).toArray(),
    collectSystemChildren({
      sourceIds: [sourceId],
      projectId: source.projectId,
    }),
  ]);
  const templates = templateRows.filter((t) => !t.deletedAt);
  const sourceTemplate = templates.find(
    (t) => t.id === source.annotationTemplateId
  );
  if (sourceTemplate?.systemRole !== SYSTEM_ROLE_SOURCE) return null;

  const procedure = getSystemProcedure(listing, procedures);
  const signature = getSystemSignature({
    source,
    pointRows,
    baseMap,
    listing,
    templates,
    procedure,
  });
  const frame = getBaseMapRowFrame(baseMap);

  // --- elements (pixels)

  let elements = [];
  const generate = await loadGenerate(procedure);
  if (frame && generate) {
    const { imageSize, meterByPx } = frame;
    const points = refs
      .map((ref, i) => {
        const row = pointRows[i];
        if (!row || row.deletedAt) return null;
        return {
          x: row.x * imageSize.width,
          y: row.y * imageSize.height,
          type: ref?.type === "circle" ? "circle" : "square",
        };
      })
      .filter(Boolean);
    elements =
      generate({
        source: getSystemEffectiveSource(source, sourceTemplate),
        points,
        closeLine: Boolean(source.closeLine),
        meterByPx,
        params: getSystemParams({ source, listing, procedure }),
      }) ?? [];
  }

  // --- desired rows

  const templateByRole = new Map();
  for (const t of templates) {
    if (t.systemRole && t.systemRole !== SYSTEM_ROLE_SOURCE)
      templateByRole.set(t.systemRole, t);
  }
  const templatePropsById = new Map();
  const seenKeys = new Set();
  const desired = [];
  for (const element of elements) {
    const template = templateByRole.get(element?.role);
    if (!template || !element.key || seenKeys.has(element.key)) continue;
    if (!element.points?.length) continue;
    seenKeys.add(element.key);
    if (!templatePropsById.has(template.id))
      templatePropsById.set(
        template.id,
        getNewAnnotationPropsFromAnnotationTemplate(template)
      );
    desired.push({
      template,
      row: {
        ...templatePropsById.get(template.id),
        annotationTemplateProps: { label: template.label },
        projectId: source.projectId,
        baseMapId: source.baseMapId,
        listingId: listing.id,
        layerId: source.layerId,
        type: element.type,
        ...(element.closeLine === undefined
          ? {}
          : { closeLine: Boolean(element.closeLine) }),
        ...(element.props ?? {}),
        systemSourceAnnotationId: sourceId,
        systemSourceTemplateId: sourceTemplate.id,
        systemElementKey: element.key,
      },
      coords: element.points.map((p) => ({
        x: p.x / frame.imageSize.width,
        y: p.y / frame.imageSize.height,
      })),
      pointTypes: element.points.map((p) =>
        p.type === "circle" ? "circle" : null
      ),
    });
  }

  // --- reconcile with the existing rows (by element key)

  const existingByKey = new Map();
  const toDelete = [];
  for (const child of existing) {
    if (!child.systemElementKey || existingByKey.has(child.systemElementKey))
      toDelete.push(child);
    else existingByKey.set(child.systemElementKey, child);
  }
  const reused = new Map(); // key → existing row
  for (const { row, coords, template } of desired) {
    const current = existingByKey.get(row.systemElementKey);
    if (!current) continue;
    const reusable =
      current.annotationTemplateId === template.id &&
      current.type === row.type &&
      (current.points?.length ?? 0) === coords.length;
    if (reusable) reused.set(row.systemElementKey, current);
  }
  for (const [key, child] of existingByKey) {
    if (!reused.has(key)) toDelete.push(child);
  }

  const reusedPointIds = [...reused.values()]
    .flatMap((c) => (c.points ?? []).map((p) => p?.id))
    .filter(Boolean);
  const reusedPointRows = reusedPointIds.length
    ? await db.points.bulkGet(reusedPointIds)
    : [];
  const pointRowById = new Map(
    reusedPointRows.filter(Boolean).map((p) => [p.id, p])
  );

  const annotationsToAdd = [];
  const annotationUpdates = [];
  const pointsToAdd = [];
  const pointUpdates = [];
  const relsToAdd = [];

  for (const { row, coords, pointTypes, template } of desired) {
    const current = reused.get(row.systemElementKey);
    if (current) {
      const nextRefs = current.points.map((ref, k) =>
        pointTypes[k] ? { id: ref.id, type: pointTypes[k] } : { id: ref.id }
      );
      const changes = diffChanges(current, { ...row, points: nextRefs });
      if (Object.keys(changes).length)
        annotationUpdates.push({ key: current.id, changes });
      coords.forEach((coord, k) => {
        const pointId = current.points[k]?.id;
        const stored = pointRowById.get(pointId);
        if (
          stored &&
          !stored.deletedAt &&
          Math.abs(stored.x - coord.x) < COORD_EPS &&
          Math.abs(stored.y - coord.y) < COORD_EPS &&
          stored.baseMapId === row.baseMapId
        )
          return;
        pointUpdates.push({
          key: pointId,
          changes: { ...coord, baseMapId: row.baseMapId },
        });
      });
      continue;
    }
    const id = nanoid();
    const newRow = { ...row, id };
    newRow.points = coords.map((coord, k) => {
      const pointId = nanoid();
      pointsToAdd.push({
        id: pointId,
        ...coord,
        projectId: row.projectId,
        baseMapId: row.baseMapId,
        listingId: row.listingId,
      });
      return pointTypes[k]
        ? { id: pointId, type: pointTypes[k] }
        : { id: pointId };
    });
    annotationsToAdd.push(newRow);
    for (const entry of template.mappingCategories ?? []) {
      const mc = parseMappingCategory(entry);
      if (!mc) continue;
      relsToAdd.push({
        id: nanoid(),
        annotationId: id,
        projectId: row.projectId,
        nomenclatureKey: mc.nomenclatureKey,
        categoryKey: mc.categoryKey,
        source: "annotationTemplate",
      });
    }
  }

  const count = desired.length;
  const geometryChanged =
    annotationsToAdd.length > 0 ||
    annotationUpdates.length > 0 ||
    pointUpdates.length > 0 ||
    toDelete.length > 0;
  const stampChanged =
    source.systemApplied?.signature !== signature ||
    source.systemApplied?.count !== count;
  if (!geometryChanged && !stampChanged) return { count };

  // --- write

  await db.transaction(
    "rw",
    db.annotations,
    db.points,
    db.relAnnotationMappingCategory,
    async (tx) => {
      tx.skipUndo = true;
      await deleteSystemChildRowsInTx(toDelete);
      if (pointsToAdd.length) await db.points.bulkAdd(pointsToAdd);
      if (pointUpdates.length) await db.points.bulkUpdate(pointUpdates);
      if (annotationsToAdd.length)
        await db.annotations.bulkAdd(annotationsToAdd);
      if (annotationUpdates.length)
        await db.annotations.bulkUpdate(annotationUpdates);
      if (relsToAdd.length)
        await db.relAnnotationMappingCategory.bulkAdd(relsToAdd);
      if (stampChanged) {
        const fresh = await db.annotations.get(sourceId);
        if (fresh && !fresh.deletedAt) {
          await db.annotations.update(sourceId, {
            systemApplied: { signature, count },
          });
        }
      }
    }
  );

  if (geometryChanged || stampChanged) dispatch?.(triggerAnnotationsUpdate());
  return { count };
}
