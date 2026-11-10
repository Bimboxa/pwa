import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

import collectPathArrayChildren from "./collectPathArrayChildren";
import { deletePathArrayChildRowsInTx } from "./deletePathArrayChildrenService";
import computeChordPieces from "../utils/computeChordPieces";
import getBaseMapRowFrame from "../utils/getBaseMapRowFrame";
import getObject3DPiecePlacement from "../utils/getObject3DPiecePlacement";
import getPathArraySignature, {
  hasPathArray,
} from "../utils/getPathArraySignature";

// Pieces shorter than this are dropped (numerical leftovers at a run end).
const MIN_PIECE_M = 0.001;
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

/**
 * (Re)generates the annotations of a path array — « Calepinage » of a
 * POLYLINE: `source.pathArray = { step (m), annotationTemplateId }`.
 *
 * The source path is walked chord by chord (computeChordPieces); every piece
 * becomes one child annotation built from the template:
 *   - OBJECT_3D template: one GLB per piece, its origin on the piece start,
 *     laid along the piece and cut (`object3DCut`) when the piece is shorter
 *     than the object;
 *   - any other template: a 2-point POLYLINE (its own two db.points rows,
 *     normalized — docs/annotations/POINTS_STORAGE.md).
 * Children carry `pathArraySourceAnnotationId` + `pathArrayIndex`.
 *
 * Existing children are RECONCILED by index (updated in place, the surplus
 * deleted) rather than recreated, so a source edit rewrites as few rows as
 * possible. Everything lands in one transaction without undo entry
 * (tx.skipUndo): the children are derived, undoing the source edit re-derives
 * them (usePathArraySync). The signature the children were generated from is
 * stored on the source (`pathArray.appliedSignature` / `appliedCount`).
 *
 * Returns { count } or null when the source carries no path array.
 */
export default async function applyPathArrayService({ sourceId, dispatch }) {
  const source = await db.annotations.get(sourceId);
  if (!hasPathArray(source)) return null;

  const config = source.pathArray;
  const refs = source.points ?? [];
  const [pointRows, baseMap, template, existing] = await Promise.all([
    db.points.bulkGet(refs.map((p) => p?.id)),
    source.baseMapId ? db.baseMaps.get(source.baseMapId) : null,
    db.annotationTemplates.get(config.annotationTemplateId),
    collectPathArrayChildren({
      sourceIds: [sourceId],
      projectId: source.projectId,
    }),
  ]);

  const signature = getPathArraySignature({
    source,
    pointRows,
    baseMap,
    template,
  });
  const frame = getBaseMapRowFrame(baseMap);
  const templateLive = template && !template.deletedAt ? template : null;

  // --- pieces (pixels)

  let pieces = [];
  if (frame && templateLive) {
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
    pieces = computeChordPieces({
      points,
      closeLine: Boolean(source.closeLine),
      step: Number(config.step) / meterByPx,
      minPiece: MIN_PIECE_M / meterByPx,
    });
  }

  // --- desired children

  const isObject3D = resolveDrawingShape(templateLive) === "OBJECT_3D";
  const templateProps = templateLive
    ? getNewAnnotationPropsFromAnnotationTemplate(templateLive)
    : {};
  const offsetZ = Number.isFinite(Number(source.offsetZ))
    ? Number(source.offsetZ)
    : templateProps.offsetZ;

  const desired = [];
  pieces.forEach((piece) => {
    const base = {
      ...templateProps,
      annotationTemplateProps: { label: templateLive.label },
      projectId: source.projectId,
      baseMapId: source.baseMapId,
      listingId: templateLive.listingId ?? source.listingId,
      layerId: source.layerId,
      offsetZ,
      pathArraySourceAnnotationId: sourceId,
      pathArrayIndex: desired.length,
    };
    if (isObject3D) {
      const placement = getObject3DPiecePlacement({
        object3D: templateLive.object3D,
        start: piece.start,
        end: piece.end,
        meterByPx: frame.meterByPx,
        imageSize: frame.imageSize,
      });
      if (!placement) return;
      desired.push({
        row: {
          ...base,
          type: "OBJECT_3D",
          bbox: placement.bbox,
          rotation: placement.rotation,
          // undefined on purpose: clears a previous cut on update.
          object3DCut: placement.object3DCut ?? undefined,
        },
      });
    } else {
      desired.push({
        row: { ...base, type: "POLYLINE" },
        coords: [piece.start, piece.end].map((p) => ({
          x: p.x / frame.imageSize.width,
          y: p.y / frame.imageSize.height,
        })),
      });
    }
  });

  // --- reconcile with the existing children

  // A template switch rebuilds everything (other type, other rels).
  const reusable = existing.every(
    (c) =>
      c.annotationTemplateId === templateLive?.id &&
      (c.type === "OBJECT_3D") === isObject3D &&
      (isObject3D || c.points?.length === 2)
  )
    ? existing
    : [];
  const toDelete = reusable.length
    ? existing.slice(desired.length)
    : [...existing];

  const reusedPointIds = reusable
    .slice(0, desired.length)
    .flatMap((c) => (c.points ?? []).map((p) => p?.id))
    .filter(Boolean);
  const reusedPointRows = reusedPointIds.length
    ? await db.points.bulkGet(reusedPointIds)
    : [];
  const pointRowById = new Map(
    reusedPointRows.filter(Boolean).map((p) => [p.id, p])
  );

  const mappingCategories = (templateLive?.mappingCategories ?? [])
    .map(parseMappingCategory)
    .filter(Boolean);

  const annotationsToAdd = [];
  const annotationUpdates = [];
  const pointsToAdd = [];
  const pointUpdates = [];
  const relsToAdd = [];

  desired.forEach(({ row, coords }, index) => {
    const current = reusable[index];
    if (current) {
      const changes = diffChanges(current, row);
      if (Object.keys(changes).length)
        annotationUpdates.push({ key: current.id, changes });
      (coords ?? []).forEach((coord, k) => {
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
      return;
    }
    const id = nanoid();
    const newRow = { ...row, id };
    if (coords) {
      newRow.points = coords.map((coord) => {
        const pointId = nanoid();
        pointsToAdd.push({
          id: pointId,
          ...coord,
          projectId: row.projectId,
          baseMapId: row.baseMapId,
          listingId: row.listingId,
        });
        return { id: pointId };
      });
    }
    annotationsToAdd.push(newRow);
    for (const mc of mappingCategories) {
      relsToAdd.push({
        id: nanoid(),
        annotationId: id,
        projectId: row.projectId,
        nomenclatureKey: mc.nomenclatureKey,
        categoryKey: mc.categoryKey,
        source: "annotationTemplate",
      });
    }
  });

  const count = desired.length;
  const geometryChanged =
    annotationsToAdd.length > 0 ||
    annotationUpdates.length > 0 ||
    pointUpdates.length > 0 ||
    toDelete.length > 0;
  const stampChanged =
    config.appliedSignature !== signature || config.appliedCount !== count;
  if (!geometryChanged && !stampChanged) return { count };

  // --- write

  await db.transaction(
    "rw",
    db.annotations,
    db.points,
    db.relAnnotationMappingCategory,
    async (tx) => {
      tx.skipUndo = true;
      await deletePathArrayChildRowsInTx(toDelete);
      if (pointsToAdd.length) await db.points.bulkAdd(pointsToAdd);
      if (pointUpdates.length) await db.points.bulkUpdate(pointUpdates);
      if (annotationsToAdd.length)
        await db.annotations.bulkAdd(annotationsToAdd);
      if (annotationUpdates.length)
        await db.annotations.bulkUpdate(annotationUpdates);
      if (relsToAdd.length)
        await db.relAnnotationMappingCategory.bulkAdd(relsToAdd);
      if (stampChanged) {
        // Re-read: the settings may have been edited since the first read.
        const fresh = await db.annotations.get(sourceId);
        if (fresh?.pathArray && !fresh.deletedAt) {
          await db.annotations.update(sourceId, {
            pathArray: {
              ...fresh.pathArray,
              appliedSignature: signature,
              appliedCount: count,
            },
          });
        }
      }
    }
  );

  if (geometryChanged) dispatch?.(triggerAnnotationsUpdate());
  return { count };
}
