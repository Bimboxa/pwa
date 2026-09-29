import db from "App/db/db";
import { verifyImageAssets } from "../utils/imageImport";
import { setPasteClipboard } from "Features/mapEditor/mapEditorSlice";
import {
  triggerAnnotationTemplatesUpdate,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import pasteAnnotationService from "Features/mapEditor/services/pasteAnnotationService";

import buildImportData from "../utils/buildImportData";
import resolveImportTemplatesService from "./resolveImportTemplatesService";
import createDetailBaseMapsFromImportService, {
  deleteCreatedDetailBaseMaps,
} from "./createDetailBaseMapsFromImportService";

/**
 * Import an already-parsed inline JSON / normalized dump (the non-mesh output
 * of parseImportAnnotationsJson) onto the main baseMap: resolve or create the
 * templates, build the paste clipboard, then either place the group directly
 * (relativeToBaseMap) or arm a single-shot paste at the next map click.
 *
 * Shared by the "Import annotations" panel and the assistant relay connector
 * (proposals detected by ChatGPT), so both paths persist annotations the same
 * way (see docs/annotations/POINTS_STORAGE.md via pasteAnnotationService).
 *
 * @param {Object} params
 * @param {Object} params.data                 - parsed payload (data.kind !== "MESH")
 * @param {string} params.projectId
 * @param {string} params.listingId            - target listing
 * @param {Object} params.mainBaseMap          - BaseMap instance (useMainBaseMap)
 * @param {number} [params.widthMeters]        - real-world image width (m)
 * @param {string[]} [params.excludedTemplateIds]
 * @param {boolean} [params.relativeToBaseMap=true]
 * @param {boolean} [params.preserveIds=false] - true for the dump format and
 *   for the relay's live jobs (their template ids are real nanoids)
 * @param {{x:number,y:number}} [params.targetCenter] - pixel anchor on the
 *   target map: when given, the group is pasted there right away even when
 *   the coordinates are not relative to the base map (live drawing centred on
 *   the user's view). Without it, non-relative imports arm a one-shot paste.
 * @param {Object} [params.annotationProps] - spread onto every placed
 *   annotation (e.g. relayJobId)
 * @param {Object} [params.templateProps]   - spread onto every CREATED template
 * @param {Object} [params.baseMapProps]    - spread onto every CREATED detail baseMap
 * @param {*} [params.createdBy]            - author of the created detail baseMaps
 * @param {Function} [params.resolveAttachment] - async (attachmentId, fileName)
 *   → resource id of the PDF behind `baseMaps[].source` (required when the
 *   payload has a `baseMaps` block)
 * @param {Map<string, string>} [params.annotationIdMapOut] - filled with
 *   payload annotation id → id of the placed annotation
 * @param {Function} params.dispatch
 * @returns {Promise<{placed: Object[], createdTemplateCount: number, relative: boolean, armed: boolean, createdBaseMapIds: string[], reusedBaseMapIds: string[], baseMapIds: Object}>}
 *   `baseMapIds` maps each payload baseMap id to its db id (created or reused).
 */
export default async function importAnnotationsInlineJsonService({
  data,
  projectId,
  listingId,
  mainBaseMap,
  widthMeters = null,
  excludedTemplateIds = [],
  relativeToBaseMap = true,
  preserveIds = false,
  targetCenter = null,
  annotationProps = null,
  templateProps = null,
  baseMapProps = null,
  createdBy = null,
  resolveAttachment = null,
  annotationIdMapOut = null,
  dispatch,
}) {
  if (!data || data.kind === "MESH") {
    throw new Error("importAnnotationsInlineJsonService: unsupported payload");
  }
  // A payload that only creates detail baseMaps needs no listing nor map.
  const baseMapsOnly =
    (data.baseMaps ?? []).length > 0 &&
    !(data.annotationTemplates ?? []).length &&
    !(data.annotations ?? []).length;
  if (!projectId || (!baseMapsOnly && (!listingId || !mainBaseMap?.id))) {
    throw new Error("importAnnotationsInlineJsonService: missing target");
  }

  await verifyImageAssets(data.imageAssets);

  // Detail baseMaps first: the DETAIL bubbles link them by payload id.
  const { baseMapIdMap, createdBaseMapIds, reusedBaseMapIds } =
    await createDetailBaseMapsFromImportService({
      baseMaps: data.baseMaps ?? [],
      projectId,
      createdBy,
      resolveAttachment,
      baseMapProps,
      dispatch,
    });
  const baseMapsResult = {
    createdBaseMapIds,
    reusedBaseMapIds,
    baseMapIds: Object.fromEntries(baseMapIdMap),
  };
  if (baseMapsOnly) {
    return {
      placed: [],
      createdTemplateIds: [],
      createdTemplateCount: 0,
      relative: false,
      armed: false,
      ...baseMapsResult,
    };
  }

  try {
    return {
      ...(await importTemplatesAndAnnotations({
        data,
        projectId,
        listingId,
        mainBaseMap,
        widthMeters,
        excludedTemplateIds,
        relativeToBaseMap,
        preserveIds,
        targetCenter,
        annotationProps,
        templateProps,
        baseMapIdMap,
        annotationIdMapOut,
        dispatch,
      })),
      ...baseMapsResult,
    };
  } catch (e) {
    // No half-made carnet: drop the baseMaps this call created.
    await deleteCreatedDetailBaseMaps(createdBaseMapIds, dispatch);
    throw e;
  }
}

async function importTemplatesAndAnnotations({
  data,
  projectId,
  listingId,
  mainBaseMap,
  widthMeters,
  excludedTemplateIds,
  relativeToBaseMap,
  preserveIds,
  targetCenter,
  annotationProps,
  templateProps,
  baseMapIdMap,
  annotationIdMapOut,
  dispatch,
}) {
  const excluded = new Set(excludedTemplateIds);
  const { templateIdMap, templateRecords } =
    await resolveImportTemplatesService({
      templates: (data.annotationTemplates ?? []).filter(
        (t) => !excluded.has(t.id)
      ),
      projectId,
      listingId,
      preserveIds,
    });

  const { clipboard, relative } = buildImportData({
    data,
    widthMeters: widthMeters > 0 ? widthMeters : undefined,
    mainBaseMap,
    projectId,
    listingId,
    excludedTemplateIds,
    relativeToBaseMap,
    templateIdMap,
    baseMapIdMap,
  });

  if (annotationProps) {
    for (const item of clipboard.items) {
      item.annotation = { ...item.annotation, ...annotationProps };
    }
  }

  // Templates first: a templates-only payload creates them and places nothing.
  if (templateRecords.length) {
    await db.annotationTemplates.bulkAdd(
      templateProps
        ? templateRecords.map((r) => ({ ...r, ...templateProps }))
        : templateRecords
    );
    dispatch(triggerAnnotationTemplatesUpdate());
  }

  if (!clipboard.items.length) {
    return {
      placed: [],
      createdTemplateIds: templateRecords.map((r) => r.id),
      createdTemplateCount: templateRecords.length,
      relative: Boolean(relative),
      armed: false,
    };
  }

  // Switch the view to the target listing so the placed annotations
  // (filtered by listingId) become visible.
  dispatch(setSelectedListingId(listingId));

  if (relative || targetCenter) {
    // Position is fixed by the baseMap (relative) or by the caller
    // (targetCenter, e.g. the centre of the user's view): place the group
    // directly with an identity transform — no manual click. A non-relative
    // paste at targetCenter rescales the group with the target map's scale
    // (widthMeters → real-world size preserved, see buildImportData).
    const placed = await pasteAnnotationService({
      pasteClipboard: clipboard,
      pasteTransform: { rotationDeg: 0, flipX: false },
      targetCenter: relative ? clipboard.sourceCenter : targetCenter,
      baseMap: mainBaseMap,
      idMapOut: annotationIdMapOut,
      dispatch,
      triggerAnnotationsUpdate,
    });
    return {
      placed: placed ?? [],
      createdTemplateIds: templateRecords.map((r) => r.id),
      createdTemplateCount: templateRecords.length,
      relative: Boolean(relative),
      armed: false,
    };
  }

  // Enter single-shot paste mode: the next click on the map positions the
  // group and exits.
  dispatch(setPasteClipboard({ ...clipboard, once: true }));
  return {
    placed: [],
    createdTemplateIds: templateRecords.map((r) => r.id),
    createdTemplateCount: templateRecords.length,
    relative: false,
    armed: true,
  };
}
