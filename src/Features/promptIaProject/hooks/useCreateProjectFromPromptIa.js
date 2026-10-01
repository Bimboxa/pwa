import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { setSelectedProjectKeyInDashboard } from "Features/dashboard/dashboardSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  triggerRelsBusinessObjectResourceUpdate,
} from "Features/businessObjects/businessObjectsSlice";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateProjectWithDefaultListings from "Features/projects/hooks/useCreateProjectWithDefaultListings";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";
import useCreateScope from "Features/scopes/hooks/useCreateScope";

import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import createScopeConfig from "Features/scopeConfig/services/createScopeConfig";
import fetchIgnStaticImage from "Features/satelliteMap/services/fetchIgnStaticImage";
import createResourcesFromFilesService from "Features/resources/services/createResourcesFromFilesService";
import createPdfBaseMapsFromPromptIaService from "../services/createPdfBaseMapsFromPromptIaService";
import createScopeBusinessObjectsFromPromptIaService from "../services/createScopeBusinessObjectsFromPromptIaService";
import {
  createPromptIaListingTemplatesService,
  importPromptIaListingAnnotationsService,
} from "../services/importPromptIaListingService";

import resolveConfigurationScopeConfig from "Features/scopeCreator/utils/resolveConfigurationScopeConfig";
import EMPTY_SCOPE_CONFIGURATION from "Features/scopeCreator/data/emptyScopeConfiguration";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import {
  convertPayloadToImageSpace,
  userToImage,
} from "Features/promptIa/utils/pdfUserSpaceToImage";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import computeBaseMapPlacementFromPointPairs from "../utils/computeBaseMapPlacementFromPointPairs";
import getSatelliteReferenceGeometry from "../utils/getSatelliteReferenceGeometry";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const SATELLITE_NAME = "Vue satellite";
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

async function getBaseMapListingsByKind(projectId) {
  const listings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && l.table === "baseMaps");
  return {
    listings,
    PLAN: listings.find((l) => !l.verticalBaseMaps),
    ELEVATION: listings.find((l) => l.verticalBaseMaps),
  };
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

// One unit per task the user can see progressing.
function countTasks(data) {
  const imports = data.scopes
    .flatMap((s) => s.listings)
    .reduce(
      (n, l) => n + new Set(l.annotations.map((a) => a.baseMapId)).size,
      0
    );
  const placements = data.baseMaps.filter((b) => b.placement).length;
  return (
    1 +
    (data.site?.reference?.type === "SATELLITE" ? 1 : 0) +
    data.baseMaps.length +
    placements +
    (data.documents?.length ?? 0) +
    data.scopes.length +
    data.scopes.filter(hasBusinessData).length +
    imports
  );
}

// Business-object listings (DPGF…) or issues to create in the scope.
function hasBusinessData(scope) {
  return Boolean(scope.businessObjectListings?.length || scope.issues?.length);
}

/**
 * Creates a whole project from the zip returned by an external AI chat
 * (see readPromptIaProjectOutputZip): project, base maps rendered from the
 * PDFs, documents (CCTP…) kept as resources, then each scope with its
 * listings, templates and annotations, its business-object listings (DPGF…)
 * linked to the annotations and the documents, and its issues (the ones the
 * model reported + the quantity gaps) in a listing of type ISSUE.
 *
 * When the json brings a site reference (satellite image, or a plan), the
 * plan views carrying annotations are then placed in space from their
 * matching points.
 *
 * create({ project, data, pdfFilesByPath, referenceImageFile,
 *   documentFilesByPath })
 *   → { ok, result } | { ok: false, error }
 *
 * A failing task is reported in `result.errors` and the batch goes on; only a
 * failed project creation stops everything.
 */
export default function useCreateProjectFromPromptIa() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const { value: userEmail } = useUserEmail();
  const userProfile = useSelector((s) => s.auth.userProfile);

  const createProject = useCreateProjectWithDefaultListings();
  const createBaseMaps = useCreateBaseMaps();
  const createScope = useCreateScope();

  // state

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, step: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);

  // helpers - base maps

  // → Map(payload baseMap id → { record, frame, page }), `page` being the
  // geometry the pdf_user_space conversion needs.
  async function createProjectBaseMaps({
    data,
    pdfFilesByPath,
    project,
    tick,
    errors,
  }) {
    const listingByKind = await getBaseMapListingsByKind(project.id);
    const { listings } = listingByKind;

    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    return createPdfBaseMapsFromPromptIaService({
      baseMaps: data.baseMaps,
      pdfFilesByPath,
      projectId: project.id,
      createBaseMaps,
      createdBy,
      getListing: (baseMap) =>
        listingByKind[baseMap.listing] ?? listingByKind.PLAN ?? listings[0],
      tick,
      errors,
    });
  }

  // helpers - placements

  // The satellite image of the site, first base map of the plan views. It
  // stays at the origin of the scene: the plans are placed against it.
  // → { record, size, meterByPx } | null
  async function createSatelliteReference({
    reference,
    referenceImageFile,
    project,
    errors,
  }) {
    try {
      const { PLAN, listings } = await getBaseMapListingsByKind(project.id);
      const listing = PLAN ?? listings[0];
      if (!listing) throw new Error("aucune liste de fonds de plan");

      const { crs, bbox } = reference;
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
      return { record, size, meterByPx: geometry.meterByPx };
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

  async function saveProjectAddress({ site, projectId }) {
    if (!site?.address && !site?.latLng) return;
    await db.projects.update(projectId, {
      address: {
        label: site.address ?? null,
        lat: site.latLng?.lat ?? null,
        lng: site.latLng?.lng ?? null,
      },
    });
  }

  // helpers - documents

  // → Map(payload document id → { resource, getPdfDocument, pagesCache,
  // destroy }), the PDF being parsed at the first title looked up in it.
  async function createProjectDocuments({
    data,
    documentFilesByPath,
    project,
    tick,
    errors,
  }) {
    const created = new Map();
    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };
    for (const document of data.documents ?? []) {
      tick(`Document « ${document.name} »`);
      try {
        const file = documentFilesByPath?.get(document.file);
        if (!file) throw new Error("fichier absent du zip");
        const [resource] = await createResourcesFromFilesService({
          files: [file],
          projectId: project.id,
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

  async function createProjectScope({
    scope,
    project,
    baseMaps,
    documents,
    data,
    tick,
    errors,
    counts,
  }) {
    tick(`Scope « ${scope.name} »`);
    const entityModelKey =
      getDefaultLocatedEntityModel(appConfig)?.key ?? "annotation";
    let rank = null;
    const newListings = scope.listings.map((listing) => {
      rank = generateKeyBetween(rank, null);
      return {
        id: listing.id,
        name: listing.name,
        entityModelKey,
        table: "entities",
        canCreateItem: true,
        projectId: project.id,
        rank,
      };
    });

    // Same setup as the "Krto vide" button: core modules, no system
    // annotation templates. The row precedes the scope (see
    // useCreateScopeFromPreset).
    await createScopeConfig({
      scopeId: scope.id,
      projectId: project.id,
      appConfig,
      ...resolveConfigurationScopeConfig(
        EMPTY_SCOPE_CONFIGURATION.scopeConfig,
        appConfig
      ),
      systemAnnotationTemplates: false,
    });
    // createScope selects the scope: the db guards then accept its
    // annotations and its points get the right scopeId.
    await createScope({
      id: scope.id,
      name: scope.name,
      projectId: project.id,
      newListings,
    });
    counts.scopes += 1;
    counts.listings += newListings.length;

    const placedAnnotationById = new Map();

    for (const listing of scope.listings) {
      try {
        counts.templates += await createListingTemplates({
          listing,
          projectId: project.id,
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
            projectId: project.id,
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

    if (!hasBusinessData(scope)) return;
    tick(`Ouvrages et points d'attention (${scope.name})`);
    const created = await createScopeBusinessObjectsFromPromptIaService({
      scope,
      projectId: project.id,
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

  // main

  const create = useCallback(
    async ({
      project,
      data,
      pdfFilesByPath,
      referenceImageFile = null,
      documentFilesByPath = null,
    }) => {
      if (runningRef.current) return { ok: false, error: "Création en cours." };
      runningRef.current = true;
      setRunning(true);
      setError(null);
      setResult(null);

      const total = countTasks(data);
      let done = 0;
      const tick = (step) => {
        done = Math.min(done + 1, total);
        setProgress({ done, total, step });
      };
      setProgress({ done: 0, total, step: "Projet" });

      const errors = [];
      const counts = {
        baseMaps: 0,
        scopes: 0,
        listings: 0,
        templates: 0,
        annotations: 0,
        skipped: 0,
        placed: 0,
        documents: 0,
        businessObjects: 0,
        issues: 0,
        qtyGapIssues: 0,
      };

      try {
        // a scope left selected by a previous session must not guard the writes
        dispatch(setSelectedScopeId(null));

        const clientRef = project.clientRef.trim();
        const existing = await db.projects
          .where("clientRef")
          .equals(clientRef)
          .first();
        if (existing && !existing.deletedAt)
          throw new Error(`Un projet porte déjà le numéro « ${clientRef} ».`);

        const created = await createProject({
          name: project.name.trim(),
          clientRef,
        });
        if (!created) throw new Error("Le projet n'a pas pu être créé.");
        tick("Fonds de plan");

        await withoutUndo(async () => {
          try {
            await saveProjectAddress({
              site: data.site,
              projectId: created.id,
            });
          } catch (e) {
            errors.push(
              `Adresse du projet non enregistrée : ${errorMessage(e)}`
            );
          }

          // before the plans: first of the listing
          let satellite = null;
          if (data.site?.reference?.type === "SATELLITE") {
            tick(SATELLITE_NAME);
            satellite = await createSatelliteReference({
              reference: data.site.reference,
              referenceImageFile,
              project: created,
              errors,
            });
          }

          const baseMaps = await createProjectBaseMaps({
            data,
            pdfFilesByPath,
            project: created,
            tick,
            errors,
          });
          counts.baseMaps = baseMaps.size + (satellite ? 1 : 0);

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
            errors.push(
              `Positionnement des fonds de plan : ${errorMessage(e)}`
            );
          }

          const documents = await createProjectDocuments({
            data,
            documentFilesByPath,
            project: created,
            tick,
            errors,
          });
          counts.documents = documents.size;

          try {
            for (const scope of data.scopes) {
              try {
                await createProjectScope({
                  scope,
                  project: created,
                  baseMaps,
                  documents,
                  data,
                  tick,
                  errors,
                  counts,
                });
              } catch (e) {
                console.error("[promptIaProject] scope failed", scope.name, e);
                errors.push(`Scope « ${scope.name} » : ${errorMessage(e)}`);
              }
            }
          } finally {
            documents.forEach((document) => document.destroy());
          }
        });

        const summary = { projectId: created.id, counts, errors };
        setProgress({ done: total, total, step: "" });
        setResult(summary);
        return { ok: true, result: summary };
      } catch (e) {
        console.error("[promptIaProject] creation failed", e);
        const message = errorMessage(e);
        setError(message);
        return { ok: false, error: message };
      } finally {
        // back to the dashboard state: nothing selected but the new project
        dispatch(setSelectedListingId(null));
        dispatch(setSelectedScopeId(null));
        dispatch(setSelectedProjectId(null));
        runningRef.current = false;
        setRunning(false);
      }
    },
    [
      dispatch,
      appConfig,
      userEmail,
      userProfile,
      createProject,
      createBaseMaps,
      createScope,
    ]
  );

  const selectCreatedProject = useCallback(
    (projectId) => {
      if (projectId)
        dispatch(setSelectedProjectKeyInDashboard(`local_${projectId}`));
    },
    [dispatch]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: 0, step: "" });
  }, []);

  return {
    create,
    selectCreatedProject,
    reset,
    running,
    progress,
    result,
    error,
  };
}
