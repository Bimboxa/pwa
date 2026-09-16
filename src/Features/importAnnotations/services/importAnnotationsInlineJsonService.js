import db from "App/db/db";
import { setPasteClipboard } from "Features/mapEditor/mapEditorSlice";
import {
  triggerAnnotationTemplatesUpdate,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import pasteAnnotationService from "Features/mapEditor/services/pasteAnnotationService";

import buildImportData from "../utils/buildImportData";
import resolveImportTemplatesService from "./resolveImportTemplatesService";

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
 * @param {boolean} [params.preserveIds=false] - true for the dump format only
 * @param {Function} params.dispatch
 * @returns {Promise<{placed: Object[], createdTemplateCount: number, relative: boolean, armed: boolean}>}
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
  dispatch,
}) {
  if (!data || data.kind === "MESH") {
    throw new Error("importAnnotationsInlineJsonService: unsupported payload");
  }
  if (!projectId || !listingId || !mainBaseMap?.id) {
    throw new Error("importAnnotationsInlineJsonService: missing target");
  }

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
  });
  if (!clipboard.items.length) {
    return {
      placed: [],
      createdTemplateCount: 0,
      relative: Boolean(relative),
      armed: false,
    };
  }

  if (templateRecords.length) {
    await db.annotationTemplates.bulkAdd(templateRecords);
    dispatch(triggerAnnotationTemplatesUpdate());
  }

  // Switch the view to the target listing so the placed annotations
  // (filtered by listingId) become visible.
  dispatch(setSelectedListingId(listingId));

  if (relative) {
    // Position is fixed by the baseMap: place the group directly at its
    // own (source) center with an identity transform — no manual click.
    const placed = await pasteAnnotationService({
      pasteClipboard: clipboard,
      pasteTransform: { rotationDeg: 0, flipX: false },
      targetCenter: clipboard.sourceCenter,
      baseMap: mainBaseMap,
      dispatch,
      triggerAnnotationsUpdate,
    });
    return {
      placed: placed ?? [],
      createdTemplateCount: templateRecords.length,
      relative: true,
      armed: false,
    };
  }

  // Enter single-shot paste mode: the next click on the map positions the
  // group and exits.
  dispatch(setPasteClipboard({ ...clipboard, once: true }));
  return {
    placed: [],
    createdTemplateCount: templateRecords.length,
    relative: false,
    armed: true,
  };
}
