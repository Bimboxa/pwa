import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";
import resolveImportTemplatesService from "Features/importAnnotations/services/resolveImportTemplatesService";

import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";

const getRecordImageSize = (record) =>
  record.image?.imageSize ?? {
    width: record.refWidth,
    height: record.refHeight,
  };

/**
 * Creates the annotation templates of a parsed Prompt IA listing (ids already
 * reminted by the parser, kept as-is). Shared by the project creation and the
 * chat Prompt IA.
 *
 * @param {Object} params
 * @param {{id: string, annotationTemplates: Object[]}} params.listing
 * @param {string} params.projectId
 * @param {Object} [params.templateProps] - spread onto every created row
 * @param {Function} params.dispatch
 * @returns {Promise<string[]>} ids of the created templates
 */
export async function createPromptIaListingTemplatesService({
  listing,
  projectId,
  templateProps = null,
  dispatch,
}) {
  if (!listing.annotationTemplates.length) return [];
  // Same validation as the import, on a templates-only payload.
  const parsed = parseImportAnnotationsJson(
    JSON.stringify({
      version: "1.0",
      image: { width: 1, height: 1 },
      annotationTemplates: listing.annotationTemplates,
      annotations: [],
    })
  );
  if (!parsed.ok) throw new Error(parsed.error ?? "Modèles invalides.");
  const { templateRecords } = await resolveImportTemplatesService({
    templates: parsed.data.annotationTemplates,
    projectId,
    listingId: listing.id,
    preserveIds: true,
  });
  if (!templateRecords.length) return [];
  await db.annotationTemplates.bulkAdd(
    templateProps
      ? templateRecords.map((record) => ({ ...record, ...templateProps }))
      : templateRecords
  );
  dispatch(triggerAnnotationTemplatesUpdate());
  return templateRecords.map((record) => record.id);
}

/**
 * Imports the annotations a parsed Prompt IA listing puts on ONE base map.
 * The templates must exist (createPromptIaListingTemplatesService).
 *
 * @param {Object} params
 * @param {{id: string, annotationTemplates: Object[]}} params.listing
 * @param {Object[]} params.annotations - parsed annotations of that base map
 * @param {Object} params.record - base map record (image size + scale)
 * @param {(payload: Object) => {data: Object, dropped: string[]}} [params.convertPayload]
 *   brings the geometry into the normalized image frame when the model wrote
 *   it in another space (pdf_user_space, world)
 * @param {string} params.projectId
 * @param {Map<string, Object>} params.placedAnnotationById - filled with
 *   parsed annotation id → annotation row written
 * @param {Object} [params.annotationProps] - spread onto every placed row
 * @param {*} [params.createdBy]
 * @param {Function} params.dispatch
 * @returns {Promise<{placed: number, dropped: number}>}
 */
export async function importPromptIaListingAnnotationsService({
  listing,
  annotations,
  record,
  convertPayload = null,
  projectId,
  placedAnnotationById,
  annotationProps = null,
  createdBy = null,
  dispatch,
}) {
  const annotationIdMapOut = new Map();
  const imageSize = getRecordImageSize(record);
  let payload = {
    version: "1.0",
    image: { width: imageSize.width, height: imageSize.height },
    annotationTemplates: listing.annotationTemplates,
    annotations: annotations.map(({ baseMapId, ...annotation }) => {
      void baseMapId;
      return annotation;
    }),
  };
  let dropped = 0;
  if (convertPayload) {
    const converted = convertPayload(payload);
    payload = converted.data;
    dropped = converted.dropped.length;
  }
  if (!payload.annotations.length) return { placed: 0, dropped };

  const parsed = parseImportAnnotationsJson(JSON.stringify(payload));
  if (!parsed.ok) throw new Error(parsed.error ?? "JSON invalide.");

  const imported = await importAnnotationsInlineJsonService({
    data: parsed.data,
    projectId,
    listingId: listing.id,
    // plain record: the import only needs the image size and the scale
    mainBaseMap: {
      ...record,
      getImageSize: () => imageSize,
      getMeterByPx: () => record.meterByPx ?? null,
    },
    relativeToBaseMap: true,
    // the templates were created just before, with these very ids
    preserveIds: true,
    ...(annotationProps ? { annotationProps } : {}),
    createdBy,
    annotationIdMapOut,
    dispatch,
  });
  // parsed id → row written, for the links of the business objects
  const rowById = new Map((imported.placed ?? []).map((a) => [a.id, a]));
  for (const [parsedId, id] of annotationIdMapOut)
    if (rowById.has(id)) placedAnnotationById.set(parsedId, rowById.get(id));
  return { placed: imported.placed?.length ?? 0, dropped };
}
