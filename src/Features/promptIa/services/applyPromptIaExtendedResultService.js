import { nanoid } from "@reduxjs/toolkit";

import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  triggerRelsBusinessObjectResourceUpdate,
} from "Features/businessObjects/businessObjectsSlice";

import db from "App/db/db";

import createIssuesFromPromptIaService from "Features/businessObjects/services/createIssuesFromPromptIaService";
import createPdfBaseMapsFromPromptIaService from "Features/promptIaProject/services/createPdfBaseMapsFromPromptIaService";
import {
  createPromptIaListingTemplatesService,
  importPromptIaListingAnnotationsService,
} from "Features/promptIaProject/services/importPromptIaListingService";

import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import computeBaseMapPlacementFromPointPairs from "Features/promptIaProject/utils/computeBaseMapPlacementFromPointPairs";
import { mapPayloadPoints } from "../utils/pdfUserSpaceToImage";
import {
  getWorldAspectGap,
  getWorldMeterByPx,
  getWorldPlacementPairs,
  MAX_WORLD_ASPECT_GAP,
  worldToImage,
} from "../utils/worldFrame";

const INCH_METERS = 0.0254;
const PDF_POINTS_PER_INCH = 72;

const errorMessage = (e) => e?.message ?? String(e);

const getRecordImageSize = (record) =>
  record.image?.imageSize ?? {
    width: record.refWidth,
    height: record.refHeight,
  };

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

async function readImageSize(file) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return size;
}

function assertAspect(world, size) {
  const gap = getWorldAspectGap(world, size);
  if (gap > MAX_WORLD_ASPECT_GAP)
    throw new Error(
      `les proportions du fichier (${Math.round(size.width)} × ${Math.round(size.height)}) ne sont pas celles de world.corners (${world.widthMeters.toFixed(2)} × ${world.heightMeters.toFixed(2)} m)`
    );
}

// The plan-view base maps listing new base maps go to: the one of the
// displayed base map, unless it holds elevations.
async function getPlanBaseMapsListing({ projectId, mainBaseMap }) {
  const listings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && l.table === "baseMaps");
  const current = listings.find((l) => l.id === mainBaseMap?.listingId);
  if (current && !current.verticalBaseMaps) return current;
  return listings.find((l) => !l.verticalBaseMaps) ?? current ?? null;
}

// → Map(parsed base map id → record)
async function createPlanBaseMaps({
  baseMaps,
  getFile,
  projectId,
  mainBaseMap,
  createBaseMaps,
  createdBy,
  batchId,
  dispatch,
  errors,
}) {
  const created = new Map();
  if (!baseMaps.length) return created;

  const listing = await getPlanBaseMapsListing({ projectId, mainBaseMap });
  if (!listing) {
    errors.push("Aucune liste de fonds de plan dans le projet.");
    return created;
  }

  // PDF sources: rendered page, PDF kept as a resource (regeneration)
  const pdfBaseMaps = baseMaps.filter((b) => b.source.isPdf);
  const pdfFilesByPath = new Map();
  for (const baseMap of pdfBaseMaps) {
    const path = baseMap.source.file;
    if (!pdfFilesByPath.has(path))
      pdfFilesByPath.set(path, await getFile(path));
  }
  const fromPdf = await createPdfBaseMapsFromPromptIaService({
    baseMaps: pdfBaseMaps.map((b) => ({
      id: b.id,
      name: b.name,
      world: b.world,
      source: {
        file: b.source.file,
        pageNumber: b.source.pageNumber,
        rotation: null,
        bboxInRatio: null,
      },
    })),
    pdfFilesByPath,
    projectId,
    createBaseMaps,
    createdBy,
    getListing: () => listing,
    // the scale comes from the world frame: the page (as displayed) covers
    // `world.widthMeters`
    getBlueprintScale: (baseMap, page) => {
      const [x0, y0, x1, y1] = page.view;
      const turned = page.rotate === 90 || page.rotate === 270;
      const size = turned
        ? { width: y1 - y0, height: x1 - x0 }
        : { width: x1 - x0, height: y1 - y0 };
      assertAspect(baseMap.world, size);
      const paperWidthMeters = (size.width / PDF_POINTS_PER_INCH) * INCH_METERS;
      return baseMap.world.widthMeters / paperWidthMeters;
    },
    errors,
  });
  for (const [id, { record }] of fromPdf) created.set(id, record);

  // picture sources
  for (const baseMap of baseMaps.filter((b) => !b.source.isPdf)) {
    try {
      const imageFile = await getFile(baseMap.source.file);
      if (!imageFile) throw new Error("fichier absent du zip");
      const size = await readImageSize(imageFile);
      assertAspect(baseMap.world, size);
      const [record] = await createBaseMaps(
        [
          {
            name: baseMap.name,
            imageFile,
            meterByPx: getWorldMeterByPx(baseMap.world, size),
          },
        ],
        { listing }
      );
      if (!record) throw new Error("fond de plan non créé");
      created.set(baseMap.id, record);
    } catch (e) {
      errors.push(
        `Fond de plan « ${baseMap.name} » non créé : ${errorMessage(e)}`
      );
    }
  }

  // World frame + pose: the first base map created stays at the origin of
  // the scene, the others are placed against it (same source coordinates).
  const placed = baseMaps.filter((b) => created.has(b.id));
  const reference = placed[0];
  const updates = [];
  for (const baseMap of placed) {
    const record = created.get(baseMap.id);
    const { unit, corners, altitude } = baseMap.world;
    const changes = {
      worldFrame: { unit, corners, altitude },
      promptIaBatchId: batchId,
      position: { x: 0, y: altitude, z: 0 },
      angleDeg: 0,
    };
    if (baseMap !== reference) {
      const referenceRecord = created.get(reference.id);
      const size = getRecordImageSize(record);
      const referenceSize = getRecordImageSize(referenceRecord);
      const placement = computeBaseMapPlacementFromPointPairs({
        pairs: getWorldPlacementPairs({
          frame: baseMap.world,
          size,
          referenceFrame: reference.world,
          referenceSize,
        }),
        planSize: size,
        planMeterByPx: record.meterByPx ?? null,
        referenceSize,
        referenceMeterByPx:
          referenceRecord.meterByPx ??
          getWorldMeterByPx(reference.world, referenceSize),
        altitude,
      });
      if (placement) {
        changes.position = placement.position;
        changes.angleDeg = placement.angleDeg;
      } else
        errors.push(
          `Fond de plan « ${baseMap.name} » : position non calculée, il reste à l'origine.`
        );
    }
    updates.push({ key: record.id, changes });
    // the annotations imported next read the record
    Object.assign(record, changes);
  }
  if (updates.length) {
    await db.baseMaps.bulkUpdate(updates);
    dispatch(triggerBaseMapsUpdate());
  }
  return created;
}

async function createIssues({
  issues,
  projectId,
  scopeId,
  appConfig,
  placedAnnotationById,
  batchId,
  dispatch,
  errors,
}) {
  const out = { issueIds: [], issuesListingId: null, createdListing: false };
  if (!issues.length) return out;
  try {
    const { listing, rows, createdListing } =
      await createIssuesFromPromptIaService({
        projectId,
        scopeId,
        appConfig,
        items: issues.map((issue) => ({
          label: issue.label,
          description: issue.description,
        })),
        reuseListing: true,
        rowProps: { promptIaBatchId: batchId },
      });
    out.issueIds = rows.map((row) => row.id);
    out.issuesListingId = listing.id;
    out.createdListing = createdListing;

    const annotationRels = [];
    const resourceRels = [];
    for (const [index, issue] of issues.entries()) {
      const row = rows[index];
      if (!row) continue;
      const base = {
        projectId: row.projectId,
        scopeId: row.scopeId,
        listingId: row.listingId,
        businessObjectId: row.id,
      };
      const annotationIds = new Set(
        issue.annotationIds
          .map((id) => placedAnnotationById.get(id)?.id)
          .filter(Boolean)
      );
      for (const annotationId of annotationIds)
        annotationRels.push({ id: nanoid(), ...base, annotationId });

      // attachments (DXF, IFC, PDF…): the whole resource
      const resourceIds = new Set(issue.documentLinks.map((l) => l.documentId));
      for (const resourceId of resourceIds) {
        const resource = await db.resources.get(resourceId);
        if (!resource || resource.deletedAt) continue;
        resourceRels.push({
          id: nanoid(),
          ...base,
          resourceId: resource.id,
          resourceName: resource.name,
          pageNumber: null,
          rects: [],
          text: "",
        });
      }
    }
    await db.transaction(
      "rw",
      db.relsBusinessObjectAnnotation,
      db.relsBusinessObjectResource,
      async () => {
        if (annotationRels.length)
          await db.relsBusinessObjectAnnotation.bulkAdd(annotationRels);
        if (resourceRels.length)
          await db.relsBusinessObjectResource.bulkAdd(resourceRels);
      }
    );
  } catch (e) {
    console.error("[promptIa] issues failed", e);
    errors.push(`Points d'attention : ${errorMessage(e)}`);
  }
  dispatch(triggerBusinessObjectsUpdate());
  dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  dispatch(triggerRelsBusinessObjectResourceUpdate());
  return out;
}

/**
 * Applies the extended part of a Prompt IA result (parsePromptIaResult) to
 * the CURRENT scope: the base maps the model created from its CAD / BIM
 * sources, one annotation listing per source, then the issues in the scope's
 * « Points d'attention » listing.
 *
 * A failing task is reported in `errors` and the batch goes on. The scope
 * must be the selected one (db guards).
 *
 * @param {Object} params
 * @param {{baseMaps: Object[], listings: Object[], issues: Object[]}} params.parsed
 * @param {(path: string) => Promise<File|null>} params.getFile - file of the
 *   returned zip
 * @param {string} params.projectId
 * @param {Object} params.scope - selected scope
 * @param {Object} params.mainBaseMap - displayed base map
 * @param {Object} params.appConfig
 * @param {Function} params.createBaseMaps - useCreateBaseMaps()
 * @param {Function} params.createListings - useCreateListings()
 * @param {{idMaster, trigram}} params.createdBy
 * @param {string|null} params.userEmail
 * @param {string} params.batchId - stamped on every created row
 *   (`promptIaBatchId`)
 * @param {Map<string, Object>} params.placedAnnotationById - annotation id of
 *   the result → row written; comes in with the annotations of the
 *   historical part, filled with the ones of the listings
 * @param {Function} params.dispatch
 * @returns {Promise<{baseMapIds: string[], listingIds: string[],
 *   templateIds: string[], placedIds: string[], dropped: number,
 *   issueIds: string[], issuesListingId: string|null,
 *   createdIssuesListing: boolean, errors: string[]}>}
 */
export default async function applyPromptIaExtendedResultService({
  parsed,
  getFile,
  projectId,
  scope,
  mainBaseMap,
  appConfig,
  createBaseMaps,
  createListings,
  createdBy,
  userEmail,
  batchId,
  placedAnnotationById,
  dispatch,
}) {
  const errors = [];
  const result = {
    baseMapIds: [],
    listingIds: [],
    templateIds: [],
    placedIds: [],
    dropped: 0,
    issueIds: [],
    issuesListingId: null,
    createdIssuesListing: false,
    errors,
  };

  // base maps

  const recordById = await createPlanBaseMaps({
    baseMaps: parsed.baseMaps,
    getFile,
    projectId,
    mainBaseMap,
    createBaseMaps,
    createdBy,
    batchId,
    dispatch,
    errors,
  });
  result.baseMapIds = [...recordById.values()].map((record) => record.id);
  const worldById = new Map(parsed.baseMaps.map((b) => [b.id, b.world]));

  // listings, templates, annotations

  const entityModel = getDefaultLocatedEntityModel(appConfig);
  for (const listing of parsed.listings) {
    try {
      await createListings({
        listings: [
          {
            id: listing.id,
            name: listing.name,
            projectId,
            canCreateItem: true,
            table: entityModel?.defaultTable ?? "entities",
            ...(entityModel && {
              entityModel,
              entityModelKey: entityModel.key,
            }),
            promptIaBatchId: batchId,
          },
        ],
        scope,
      });
      result.listingIds.push(listing.id);
      result.templateIds.push(
        ...(await createPromptIaListingTemplatesService({
          listing,
          projectId,
          templateProps: { promptIaBatchId: batchId },
          dispatch,
        }))
      );
    } catch (e) {
      console.error("[promptIa] listing failed", listing.name, e);
      errors.push(`Liste « ${listing.name} » : ${errorMessage(e)}`);
      continue;
    }

    for (const [baseMapId, annotations] of groupBy(
      listing.annotations,
      (a) => a.baseMapId
    )) {
      const record = recordById.get(baseMapId);
      if (!record) {
        result.dropped += annotations.length;
        continue; // its base map failed, already reported
      }
      try {
        const world = worldById.get(baseMapId);
        const before = new Set(placedAnnotationById.keys());
        const { dropped } = await importPromptIaListingAnnotationsService({
          listing,
          annotations,
          record,
          convertPayload:
            listing.coordinateSpace === "world"
              ? (payload) =>
                  mapPayloadPoints(payload, (p) => worldToImage(world, p))
              : null,
          projectId,
          placedAnnotationById,
          annotationProps: { promptIaBatchId: batchId },
          createdBy: userEmail ?? null,
          dispatch,
        });
        result.dropped += dropped;
        for (const [id, row] of placedAnnotationById)
          if (!before.has(id)) result.placedIds.push(row.id);
      } catch (e) {
        result.dropped += annotations.length;
        errors.push(
          `Annotations « ${listing.name} » sur « ${record.name} » : ${errorMessage(e)}`
        );
      }
    }
  }

  // issues

  const issues = await createIssues({
    issues: parsed.issues,
    projectId,
    scopeId: scope.id,
    appConfig,
    placedAnnotationById,
    batchId,
    dispatch,
    errors,
  });
  result.issueIds = issues.issueIds;
  result.issuesListingId = issues.issuesListingId;
  result.createdIssuesListing = issues.createdListing;

  return result;
}
