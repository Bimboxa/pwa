import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBlankBaseMapGeometry, {
  getBlankBaseMapPrintZone,
} from "Features/baseMaps/utils/getBlankBaseMapGeometry";

import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import printLocalScanSectionService from "Features/localScans/services/printLocalScanSectionService";
import { withUndoGroup } from "App/db/undoManager";
import { getTemplatelessDraft } from "Features/mapEditor/utils/startTemplatelessDraw";
import vectorizeLocalScanSectionService from "Features/baseMapClipping/services/vectorizeLocalScanSectionService";
import buildVectorizedSectionRows from "Features/baseMapClipping/utils/buildVectorizedSectionRows";

import { SECTION_BASE_MAP_MODES } from "../sectionBaseMapPlacementSlice";
import { createGeometryBaseMap } from "./getHydratedBaseMap";
import { isBaseMapLinkSource } from "../utils/baseMapLinkPredicates";
import { buildBaseMapLinkCloneDraft } from "../utils/startBaseMapLinkTools";
import resyncBaseMapLinkPlacementsService from "./resyncBaseMapLinkPlacementsService";

// Validation of the « + fond de plan » placement of a section mark (Space):
//
// 1. BLANK mode: a vertical blank page is created (same record as
//    DialogCreateBlankBaseMap), with no pose of its own;
//    EXISTING mode: the picked vertical base map is used as is.
// 2. The mark is LOCATED on that base map, exactly like the 2D locate flow
//    (useHandleCommitDrawing): its keep-scale clone is created from the
//    previewed placement (`cloneNorm`, see computeSectionBaseMapPlacement),
//    any earlier clone of the mark is removed, and the source targets the
//    base map (`linkedBaseMapId`).
// 3. resyncBaseMapLinkPlacementsService — the single writer of the pose of
//    the vertical base maps driven by a section mark — poses it: the clone
//    encodes the previewed pose, so the base map lands where it was shown.
//
//
// Two options of the placement come first:
//
// 0a. `sourceAnchorsWorld` ({ A, B } in world metres): the page was moved
//     along the normal of the section plane (↑ / ↓), so the MARK itself is
//     moved there — its two db.points rows, normalized on the plan base map.
//     The solver of step 3 reads the mark: it must move before the pose.
// 0b. `cloudPrint` ({ toleranceM, clouds }, blank page only) with `pagePose`
//     ({ position, angleDeg }, the previewed pose): the point clouds within
//     the tolerance of the page are printed on it
//     (printLocalScanSectionService) and that image replaces the white page.
//     No point in the slab → the white page, as without the option.
// 0c. `cloudVectorize` ({ toleranceM, clouds }, blank page only), same slab:
//     the footprint of the clouds is vectorized
//     (vectorizeLocalScanSectionService) and drawn on the new base map as
//     templateless POLYLINE annotations, once it is posed. Alone, the base
//     map stays a white page (no image); with `cloudPrint`, the lines lie
//     over the printed image.
//
// `createBaseMapFromImageFn` = useCreateBaseMapFromImage, `createAnnotationFn`
// = useCreateAnnotation. Returns { baseMapId, listingId, printedPointCount,
// vectorizedLineCount (both null when not asked) }, or null when nothing
// was created.
export default async function createSectionBaseMapService({
  sourceAnnotationId,
  mode,
  blank,
  existingBaseMapId,
  cloneNorm,
  sourceAnchorsWorld = null,
  pagePose = null,
  cloudPrint = null,
  cloudVectorize = null,
  projectId,
  scopeId,
  createBaseMapFromImageFn,
  createAnnotationFn,
  dispatch,
}) {
  if (!sourceAnnotationId || !cloneNorm?.q1 || !cloneNorm?.q2) return null;
  const source = await db.annotations.get(sourceAnnotationId);
  if (!source || source.deletedAt || !isBaseMapLinkSource(source)) return null;

  // --- 0a. the mark follows the page along the normal ---

  let markUpdates = null;
  if (sourceAnchorsWorld?.A && sourceAnchorsWorld?.B) {
    if (source.points?.length !== 2) return null;
    const planRecord = await db.baseMaps.get(source.baseMapId);
    if (!planRecord || planRecord.deletedAt) return null;
    const planBaseMap = createGeometryBaseMap(
      planRecord,
      await db.baseMapVersions
        .where("baseMapId")
        .equals(planRecord.id)
        .toArray()
    );
    const norms = [sourceAnchorsWorld.A, sourceAnchorsWorld.B].map((world) =>
      worldToBaseMapNormalized(world, planBaseMap)
    );
    if (norms.some((n) => !Number.isFinite(n?.x) || !Number.isFinite(n?.y)))
      return null;
    markUpdates = norms.map((n, i) => ({
      key: source.points[i].id,
      changes: { x: n.x, y: n.y },
    }));
  }

  // --- 1. the vertical base map ---

  let baseMapId = null;
  let printedPointCount = null;
  // { polylines, widthM, heightM } of the new page (0c), drawn at the end
  let vectorized = null;
  if (mode === SECTION_BASE_MAP_MODES.EXISTING) {
    const record = existingBaseMapId
      ? await db.baseMaps.get(existingBaseMapId)
      : null;
    if (!record || record.deletedAt || record.orientation !== "VERTICAL")
      return null;
    baseMapId = record.id;
  } else {
    const name = String(blank?.name ?? "").trim();
    if (!name || !blank?.listing) return null;
    const { format, size, scale } = blank;
    const { pixelWidth, pixelHeight, meterByPx } = getBlankBaseMapGeometry({
      format,
      size,
      scale,
    });
    const page = pagePose?.position
      ? {
          orientation: "VERTICAL",
          angleDeg: pagePose.angleDeg,
          position: pagePose.position,
          width: pixelWidth,
          height: pixelHeight,
          meterByPx,
        }
      : null;
    // --- 0b. the point clouds cut by the page, printed on it ---
    let printed = null;
    if (cloudPrint?.clouds?.length && page) {
      printed = await printLocalScanSectionService({
        clouds: cloudPrint.clouds,
        toleranceM: cloudPrint.toleranceM,
        name,
        page,
      });
    }
    if (cloudPrint) printedPointCount = printed?.pointCount ?? 0;
    // --- 0c. … and vectorized (computed before anything is created) ---
    if (cloudVectorize?.clouds?.length && page) {
      const { polylines } = await vectorizeLocalScanSectionService({
        clouds: cloudVectorize.clouds,
        toleranceM: cloudVectorize.toleranceM,
        page,
      });
      vectorized = {
        polylines,
        widthM: pixelWidth * meterByPx,
        heightM: pixelHeight * meterByPx,
      };
    }
    const entity = await createBaseMapFromImageFn({
      ...(printed
        ? { file: printed.file }
        : // no image file: the white page is synthesized at hydration
          { whitePage: { width: pixelWidth, height: pixelHeight } }),
      name,
      listing: blank.listing,
      meterByPx,
      orientation: "VERTICAL",
      printZone: getBlankBaseMapPrintZone({
        format,
        size,
        scale,
        pixelWidth,
        pixelHeight,
      }),
      // the caller selects it once it is posed
      selectOnCreate: false,
    });
    baseMapId = entity?.id ?? null;
  }
  if (!baseMapId) return null;

  // The mark moves once the page exists (nothing to undo on a failure
  // above), and before the clone is solved against it.
  if (markUpdates) await db.points.bulkUpdate(markUpdates);

  // --- 2. locate the mark on it (keep-scale clone) ---

  const previous = (
    await db.annotations.where("projectId").equals(source.projectId).toArray()
  ).filter(
    (a) =>
      !a.deletedAt &&
      a.type === "BASE_MAP_LINK" &&
      a.sourceLinkAnnotationId === source.id
  );
  // Soft delete (db.js middleware) — keeps undo working.
  for (const p of previous) await db.annotations.delete(p.id);

  const pointRows = [cloneNorm.q1, cloneNorm.q2].map((q) => ({
    id: nanoid(),
    x: q.x,
    y: q.y,
    baseMapId,
    projectId: projectId ?? source.projectId,
    listingId: null,
  }));
  // The draft's label / length only feed the 2D drawing ghost: a clone
  // stores neither (it reads its label from the source).
  const cloneDraft = buildBaseMapLinkCloneDraft(source);
  delete cloneDraft.label;
  delete cloneDraft.sourceLinkLengthM;
  const clone = await createAnnotationFn(
    {
      ...cloneDraft,
      id: nanoid(),
      baseMapId,
      scopeId: scopeId ?? source.scopeId ?? null,
      listingId: null,
      points: pointRows.map((row) => ({ id: row.id })),
      adaptScale: false,
    },
    { pointRowsToSave: pointRows }
  );
  if (!clone?.id) return null;

  if (source.linkedBaseMapId !== baseMapId) {
    await db.annotations.update(source.id, { linkedBaseMapId: baseMapId });
  }

  // --- 3. pose the base map ---

  await resyncBaseMapLinkPlacementsService({ cloneId: clone.id, dispatch });

  // --- 0c (end). the vectorized lines, on the posed base map ---

  let vectorizedLineCount = null;
  if (cloudVectorize) {
    const { newPoints, newAnnotations } = buildVectorizedSectionRows({
      polylines: vectorized?.polylines ?? [],
      widthM: vectorized?.widthM,
      heightM: vectorized?.heightM,
      baseMapId,
      projectId: projectId ?? source.projectId,
      scopeId: scopeId ?? source.scopeId ?? null,
      annotationProps: getTemplatelessDraft("POLYLINE"),
      createId: nanoid,
    });
    if (newAnnotations.length) {
      await withUndoGroup(async () => {
        await db.transaction("rw", db.points, db.annotations, async () => {
          await db.points.bulkAdd(newPoints);
          await db.annotations.bulkAdd(newAnnotations);
        });
      });
    }
    vectorizedLineCount = newAnnotations.length;
  }
  dispatch?.(triggerAnnotationsUpdate());

  const record = await db.baseMaps.get(baseMapId);
  return {
    baseMapId,
    listingId: record?.listingId ?? null,
    printedPointCount,
    vectorizedLineCount,
  };
}
