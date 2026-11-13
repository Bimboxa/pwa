import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBlankBaseMapGeometry, {
  getBlankBaseMapPrintZone,
} from "Features/baseMaps/utils/getBlankBaseMapGeometry";

import { SECTION_BASE_MAP_MODES } from "../sectionBaseMapPlacementSlice";
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
// `createBaseMapFromImageFn` = useCreateBaseMapFromImage, `createAnnotationFn`
// = useCreateAnnotation. Returns { baseMapId, listingId }, or null when
// nothing was created.
export default async function createSectionBaseMapService({
  sourceAnnotationId,
  mode,
  blank,
  existingBaseMapId,
  cloneNorm,
  projectId,
  scopeId,
  createBaseMapFromImageFn,
  createAnnotationFn,
  dispatch,
}) {
  if (!sourceAnnotationId || !cloneNorm?.q1 || !cloneNorm?.q2) return null;
  const source = await db.annotations.get(sourceAnnotationId);
  if (!source || source.deletedAt || !isBaseMapLinkSource(source)) return null;

  // --- 1. the vertical base map ---

  let baseMapId = null;
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
    const entity = await createBaseMapFromImageFn({
      // no image file: the white page is synthesized at hydration
      whitePage: { width: pixelWidth, height: pixelHeight },
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
  dispatch?.(triggerAnnotationsUpdate());

  const record = await db.baseMaps.get(baseMapId);
  return { baseMapId, listingId: record?.listingId ?? null };
}
