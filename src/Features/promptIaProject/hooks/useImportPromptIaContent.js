import { useDispatch, useSelector } from "react-redux";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  triggerRelsBusinessObjectResourceUpdate,
} from "Features/businessObjects/businessObjectsSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";

import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import fetchIgnStaticImage from "Features/satelliteMap/services/fetchIgnStaticImage";
import createResourcesFromFilesService from "Features/resources/services/createResourcesFromFilesService";
import createPdfBaseMapsFromPromptIaService from "../services/createPdfBaseMapsFromPromptIaService";
import createScopeBusinessObjectsFromPromptIaService from "../services/createScopeBusinessObjectsFromPromptIaService";
import {
  createPromptIaListingTemplatesService,
  importPromptIaListingAnnotationsService,
} from "../services/importPromptIaListingService";

import {
  convertPayloadToImageSpace,
  userToImage,
} from "Features/promptIa/utils/pdfUserSpaceToImage";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import computeBaseMapPlacementFromPointPairs from "../utils/computeBaseMapPlacementFromPointPairs";
import getSatelliteReferenceGeometry from "../utils/getSatelliteReferenceGeometry";
import { groupBy } from "../utils/promptIaImportTasks";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const SATELLITE_NAME = "Vue satellite";
const SATELLITE_DEFAULT_LAYER = "ORTHOIMAGERY.ORTHOPHOTOS";
// Beyond, the placement is applied but reported as doubtful.
const MAX_PLACEMENT_RMS_METERS = 1;
const MAX_SCALE_GAP = 0.05;

const errorMessage = (e) => e?.message ?? String(e);

const getRecordImageSize = (record) =>
  record.image?.imageSize ?? {
    width: record.refWidth,
    height: record.refHeight,
  };

async function readImageSize(file) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return size;
}

export async function getBaseMapListingsByKind(projectId) {
  const listings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && l.table === "baseMaps");
  return {
    listings,
    PLAN: listings.find((l) => !l.verticalBaseMaps),
    ELEVATION: listings.find((l) => l.verticalBaseMaps),
  };
}

const sameBbox = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((v, i) => Math.abs(Number(v) - Number(b[i])) < 1e-6);

/**
 * Imports the content of a zip returned by an external AI chat (see
 * readPromptIaProjectOutputZip) into an EXISTING project — the part shared
 * by the dashboard "Prompt IA" project creation and the "Prompt IA" Krto
 * configuration.
 *
 * importProjectContent({ projectId, data, pdfFilesByPath, referenceImageFile,
 *   documentFilesByPath, tick, errors, counts })
 *   → { baseMaps: Map(payload id → { record, frame, page }), satellite,
 *       documents: Map(payload id → { resource, getPdfDocument, … }),
 *       destroy() }
 *   Satellite reference (when `site.reference.type === "SATELLITE"`), base
 *   maps rendered from the PDFs into the project's PLAN / ELEVATION listings
 *   (the project must have at least one base maps listing), placements from
 *   the matching points, documents kept as PROJECT resources. One failing
 *   item is reported in `errors` and the import goes on. Call `destroy()`
 *   once the scopes are imported (releases the parsed PDF documents).
 *
 * importScopeContent({ scope, projectId, data, baseMaps, documents, tick,
 *   errors, counts })
 *   Templates, annotations per base map, business-object listings and
 *   issues of one scope. The scope row must exist AND be the selected scope
 *   (db guards): the caller creates it with useCreateScope first. `scope.id`
 *   is the id written on the business-object listings.
 *
 * Both run inside the caller's `withoutUndo`.
 */
export default function useImportPromptIaContent() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const { value: userEmail } = useUserEmail();
  const userProfile = useSelector((s) => s.auth.userProfile);

  const createBaseMaps = useCreateBaseMaps();

  // helpers

  function getCreatedBy() {
    const debugAuth = getDebugAuthFromLocalStorage();
    return {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };
  }

  // helpers - base maps

  // → Map(payload baseMap id → { record, frame, page }), `page` being the
  // geometry the pdf_user_space conversion needs.
  async function createProjectBaseMaps({
    data,
    pdfFilesByPath,
    projectId,
    tick,
    errors,
  }) {
    const listingByKind = await getBaseMapListingsByKind(projectId);
    const { listings } = listingByKind;

    return createPdfBaseMapsFromPromptIaService({
      baseMaps: data.baseMaps,
      pdfFilesByPath,
      projectId,
      createBaseMaps,
      createdBy: getCreatedBy(),
      getListing: (baseMap) =>
        listingByKind[baseMap.listing] ?? listingByKind.PLAN ?? listings[0],
      tick,
      errors,
    });
  }

  // helpers - placements

  // The satellite image of the site, first base map of the plan views. It
  // stays at the origin of the scene: the plans are placed against it. A
  // satellite view already created in the project for the same extent (a
  // previous Prompt IA Krto) is reused rather than duplicated.
  // → { record, size, meterByPx } | null
  async function createSatelliteReference({
    reference,
    referenceImageFile,
    projectId,
    errors,
  }) {
    try {
      const { PLAN, listings } = await getBaseMapListingsByKind(projectId);
      const listing = PLAN ?? listings[0];
      if (!listing) throw new Error("aucune liste de fonds de plan");

      const { crs, bbox } = reference;

      const existing = (
        await db.baseMaps.where("projectId").equals(projectId).toArray()
      ).find(
        (b) =>
          !b.deletedAt &&
          b.geo?.mode === "LAMBERT_CC" &&
          b.geo.crs === crs &&
          sameBbox(b.geo.bbox, bbox)
      );
      if (existing) {
        return {
          record: existing,
          size: existing.geo.imageSize ?? getRecordImageSize(existing),
          meterByPx: existing.meterByPx,
        };
      }

      let imageFile = referenceImageFile;
      let layer = reference.layer;
      if (!imageFile) {
        // deterministic request: same image as the one the model worked on
        layer = layer ?? SATELLITE_DEFAULT_LAYER;
        const fetched = await fetchIgnStaticImage({
          crs,
          bbox,
          width: reference.width,
          height: reference.height,
          layers: [layer],
        });
        imageFile = fetched.file;
      }
      const size = await readImageSize(imageFile);
      const geometry = getSatelliteReferenceGeometry({ crs, bbox, ...size });

      const [record] = await createBaseMaps(
        [{ name: SATELLITE_NAME, imageFile, meterByPx: geometry.meterByPx }],
        { listing }
      );
      if (!record) throw new Error("fond de plan non créé");
      await db.baseMaps.update(record.id, {
        latLng: { ...geometry.topLeftLatLng, x: 0, y: 0 },
        geo: {
          mode: "LAMBERT_CC",
          crs,
          bbox,
          scaleFactor: geometry.scaleFactor,
          layer: layer ?? null,
          imageSize: size,
        },
      });
      return { record, size, meterByPx: geometry.meterByPx, created: true };
    } catch (e) {
      console.error("[promptIaProject] satellite reference failed", e);
      errors.push(
        `Image satellite non créée, fonds de plan non positionnés : ${errorMessage(e)}`
      );
      return null;
    }
  }

  async function placeProjectBaseMaps({
    data,
    baseMaps,
    satellite,
    tick,
    errors,
    counts,
  }) {
    const toPlace = data.baseMaps.filter((b) => b.placement);
    if (!toPlace.length) return;
    const skipAll = (message) => {
      if (message) errors.push(message);
      toPlace.forEach((b) => tick(`Position « ${b.name} » ignorée`));
    };

    const { reference } = data.site;
    const inPdfSpace = data.coordinateSpace === "pdf_user_space";
    // normalized point of a base map of the json → pixels
    const toPixels = (point, target) => {
      const size = getRecordImageSize(target.record);
      const p = inPdfSpace
        ? userToImage(point, target.frame, target.page)
        : point;
      return { x: p.x * size.width, y: p.y * size.height };
    };

    let referenceSize = null;
    let referenceMeterByPx = null;
    let referenceToPixels = null;
    if (reference.type === "SATELLITE") {
      if (!satellite) return skipAll(); // already reported
      referenceSize = satellite.size;
      referenceMeterByPx = satellite.meterByPx;
      // always normalized in the image, whatever the coordinate space
      referenceToPixels = (p) => ({
        x: p.x * referenceSize.width,
        y: p.y * referenceSize.height,
      });
    } else {
      const target = baseMaps.get(reference.baseMapId);
      if (!target)
        return skipAll(
          "Fonds de plan non positionnés : le fond de référence n'a pas été créé."
        );
      referenceMeterByPx = target.record.meterByPx ?? null;
      if (!referenceMeterByPx)
        return skipAll(
          `Fonds de plan non positionnés : le fond de référence « ${target.record.name} » n'a pas d'échelle.`
        );
      referenceSize = getRecordImageSize(target.record);
      referenceToPixels = (p) => toPixels(p, target);
    }

    const updates = [];
    for (const baseMap of toPlace) {
      tick(`Position « ${baseMap.name} »`);
      const target = baseMaps.get(baseMap.id);
      if (!target) continue; // its creation failed, already reported
      const planMeterByPx = target.record.meterByPx ?? null;
      const placement = computeBaseMapPlacementFromPointPairs({
        pairs: baseMap.placement.points.map((pair) => ({
          plan: toPixels(pair.plan, target),
          reference: referenceToPixels(pair.reference),
        })),
        planSize: getRecordImageSize(target.record),
        planMeterByPx,
        referenceSize,
        referenceMeterByPx,
        altitude: baseMap.placement.altitude,
      });
      if (!placement) {
        errors.push(
          `Fond de plan « ${baseMap.name} » non positionné : points homologues inexploitables.`
        );
        continue;
      }

      if (!planMeterByPx)
        errors.push(
          `Fond de plan « ${baseMap.name} » : échelle déduite des points homologues, à vérifier.`
        );
      else if (Math.abs(placement.scaleRatio - 1) > MAX_SCALE_GAP)
        errors.push(
          `Fond de plan « ${baseMap.name} » : position à vérifier, les points homologues donnent une échelle ${Math.round(
            (placement.scaleRatio - 1) * 100
          )} % différente de celle du plan.`
        );
      else if (placement.rmsMeters > MAX_PLACEMENT_RMS_METERS)
        errors.push(
          `Fond de plan « ${baseMap.name} » : position à vérifier (écart moyen ${placement.rmsMeters.toFixed(1)} m).`
        );

      const changes = {
        position: placement.position,
        angleDeg: placement.angleDeg,
        ...(!planMeterByPx && { meterByPx: placement.meterByPx }),
      };
      updates.push({ key: target.record.id, changes });
      // the annotations imported next read the scale on the record
      Object.assign(target.record, changes);
    }

    if (!updates.length) return;
    await db.baseMaps.bulkUpdate(updates);
    dispatch(triggerBaseMapsUpdate());
    counts.placed = updates.length;
  }

  // helpers - documents

  // → Map(payload document id → { resource, getPdfDocument, pagesCache,
  // destroy }), the PDF being parsed at the first title looked up in it.
  async function createProjectDocuments({
    data,
    documentFilesByPath,
    projectId,
    tick,
    errors,
  }) {
    const created = new Map();
    const createdBy = getCreatedBy();
    for (const document of data.documents ?? []) {
      tick(`Document « ${document.name} »`);
      try {
        const file = documentFilesByPath?.get(document.file);
        if (!file) throw new Error("fichier absent du zip");
        const [resource] = await createResourcesFromFilesService({
          files: [file],
          projectId,
          visibility: "PROJECT",
          createdBy,
          // designated as a text document by the model: the viewer with
          // the highlights, whatever the text density says
          props: /\.pdf$/i.test(file.name) ? { isDocument: true } : null,
        });
        if (!resource) throw new Error("ressource non créée");

        let loadingTask = null;
        created.set(document.id, {
          resource,
          pagesCache: new Map(),
          getPdfDocument: async () => {
            if (resource.fileType !== "PDF") return null;
            if (!loadingTask)
              loadingTask = getDocument({
                data: await file.arrayBuffer(),
                ...PDFJS_DOC_PARAMS,
              });
            return loadingTask.promise;
          },
          destroy: () => loadingTask?.destroy().catch(() => {}),
        });
      } catch (e) {
        errors.push(
          `Document « ${document.name} » non créé : ${errorMessage(e)}`
        );
      }
    }
    return created;
  }

  // helpers - scopes

  async function createListingTemplates({ listing, projectId }) {
    const ids = await createPromptIaListingTemplatesService({
      listing,
      projectId,
      dispatch,
    });
    return ids.length;
  }

  function importListingAnnotations({
    listing,
    annotations,
    target,
    coordinateSpace,
    projectId,
    placedAnnotationById,
  }) {
    const { record, frame, page } = target;
    return importPromptIaListingAnnotationsService({
      listing,
      annotations,
      record,
      convertPayload:
        coordinateSpace === "pdf_user_space"
          ? (payload) => convertPayloadToImageSpace(payload, frame, page)
          : null,
      projectId,
      placedAnnotationById,
      createdBy: userEmail ?? null,
      dispatch,
    });
  }

  // main

  async function importProjectContent({
    projectId,
    data,
    pdfFilesByPath,
    referenceImageFile = null,
    documentFilesByPath = null,
    tick,
    errors,
    counts,
  }) {
    // before the plans: first of the listing
    let satellite = null;
    if (data.site?.reference?.type === "SATELLITE") {
      tick(SATELLITE_NAME);
      satellite = await createSatelliteReference({
        reference: data.site.reference,
        referenceImageFile,
        projectId,
        errors,
      });
    }

    const baseMaps = await createProjectBaseMaps({
      data,
      pdfFilesByPath,
      projectId,
      tick,
      errors,
    });
    counts.baseMaps = baseMaps.size + (satellite?.created ? 1 : 0);

    try {
      await placeProjectBaseMaps({
        data,
        baseMaps,
        satellite,
        tick,
        errors,
        counts,
      });
    } catch (e) {
      console.error("[promptIaProject] placements failed", e);
      errors.push(`Positionnement des fonds de plan : ${errorMessage(e)}`);
    }

    const documents = await createProjectDocuments({
      data,
      documentFilesByPath,
      projectId,
      tick,
      errors,
    });
    counts.documents = documents.size;

    return {
      baseMaps,
      satellite,
      documents,
      destroy: () => documents.forEach((document) => document.destroy()),
    };
  }

  async function importScopeContent({
    scope,
    projectId,
    data,
    baseMaps,
    documents,
    tick,
    errors,
    counts,
  }) {
    const placedAnnotationById = new Map();

    for (const listing of scope.listings) {
      try {
        counts.templates += await createListingTemplates({
          listing,
          projectId,
        });
      } catch (e) {
        errors.push(
          `Liste « ${listing.name} » (${scope.name}) : ${errorMessage(e)}`
        );
        // without templates the annotations cannot be placed
        new Set(listing.annotations.map((a) => a.baseMapId)).forEach(() =>
          tick(`Liste « ${listing.name} » ignorée`)
        );
        continue;
      }

      for (const [baseMapId, annotations] of groupBy(
        listing.annotations,
        (a) => a.baseMapId
      )) {
        tick(`Annotations « ${listing.name} » (${scope.name})`);
        const target = baseMaps.get(baseMapId);
        if (!target) {
          counts.skipped += annotations.length;
          continue; // its base map failed, already reported
        }
        try {
          const { placed, dropped } = await importListingAnnotations({
            listing,
            annotations,
            target,
            coordinateSpace: data.coordinateSpace,
            projectId,
            placedAnnotationById,
          });
          counts.annotations += placed;
          counts.skipped += dropped;
        } catch (e) {
          counts.skipped += annotations.length;
          errors.push(
            `Annotations « ${listing.name} » sur « ${target.record.name} » : ${errorMessage(e)}`
          );
        }
      }
    }

    if (!scope.businessObjectListings?.length && !scope.issues?.length) return;
    tick(`Ouvrages et points d'attention (${scope.name})`);
    const created = await createScopeBusinessObjectsFromPromptIaService({
      scope,
      projectId,
      appConfig,
      placedAnnotationById,
      baseMapById: new Map(
        [...baseMaps.values()].map(({ record }) => [record.id, record])
      ),
      documentById: documents,
      errors,
    });
    counts.businessObjects += created.businessObjects;
    counts.issues += created.issues;
    counts.qtyGapIssues += created.qtyGapIssues;
    dispatch(triggerBusinessObjectsUpdate());
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
    dispatch(triggerRelsBusinessObjectResourceUpdate());
  }

  return { importProjectContent, importScopeContent };
}
