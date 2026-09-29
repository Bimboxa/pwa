import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { setSelectedProjectKeyInDashboard } from "Features/dashboard/dashboardSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateProjectWithDefaultListings from "Features/projects/hooks/useCreateProjectWithDefaultListings";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";
import useCreateScope from "Features/scopes/hooks/useCreateScope";

import ensurePdfPageResources from "Features/resources/services/ensurePdfPageResourcesService";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import createScopeConfig from "Features/scopeConfig/services/createScopeConfig";
import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";
import resolveImportTemplatesService from "Features/importAnnotations/services/resolveImportTemplatesService";

import renderTempBaseMapImage from "Features/baseMapCreator/utils/renderTempBaseMapImage";
import resolveConfigurationScopeConfig from "Features/scopeCreator/utils/resolveConfigurationScopeConfig";
import EMPTY_SCOPE_CONFIGURATION from "Features/scopeCreator/data/emptyScopeConfiguration";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";
import { convertPayloadToImageSpace } from "Features/promptIa/utils/pdfUserSpaceToImage";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const errorMessage = (e) => e?.message ?? String(e);

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
  return 1 + data.baseMaps.length + data.scopes.length + imports;
}

/**
 * Creates a whole project from the zip returned by an external AI chat
 * (see readPromptIaProjectOutputZip): project, base maps rendered from the
 * PDFs, then each scope with its listings, templates and annotations.
 *
 * create({ project, data, pdfFilesByPath }) → { ok, result } | { ok: false, error }
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
    const created = new Map();
    const listings = (
      await db.listings.where("projectId").equals(project.id).toArray()
    ).filter((l) => !l.deletedAt && l.table === "baseMaps");
    const listingByKind = {
      PLAN: listings.find((l) => !l.verticalBaseMaps),
      ELEVATION: listings.find((l) => l.verticalBaseMaps),
    };

    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    const prepared = [];
    for (const [path, baseMaps] of groupBy(
      data.baseMaps,
      (b) => b.source.file
    )) {
      const pdfFile = pdfFilesByPath.get(path);
      let pdfDocument = null;
      try {
        pdfDocument = await getDocument({
          data: await pdfFile.arrayBuffer(),
          ...PDFJS_DOC_PARAMS,
        }).promise;
      } catch (e) {
        errors.push(`PDF « ${path} » illisible : ${errorMessage(e)}`);
        baseMaps.forEach((b) => tick(`Fond de plan « ${b.name} » ignoré`));
        continue;
      }

      try {
        const rendered = [];
        for (const baseMap of baseMaps) {
          tick(`Fond de plan « ${baseMap.name} »`);
          const { pageNumber, bboxInRatio } = baseMap.source;
          try {
            if (pageNumber > pdfDocument.numPages)
              throw new Error(
                `page ${pageNumber} absente (${pdfDocument.numPages} page(s))`
              );
            const pdfPage = await pdfDocument.getPage(pageNumber);
            // absolute rotation: the page's own /Rotate unless overridden
            const rotate = baseMap.source.rotation ?? pdfPage.rotate ?? 0;
            const { imageFile, meterByPx, dpi } = await renderTempBaseMapImage({
              pdfFile,
              pdfDocument,
              page: pageNumber,
              bboxInRatio,
              rotate,
              blueprintScale: baseMap.blueprintScale,
              resolution: null, // AUTO
            });
            rendered.push({
              baseMap,
              imageFile,
              meterByPx,
              dpi,
              rotate,
              page: { view: pdfPage.view.map(Number) },
            });
          } catch (e) {
            errors.push(
              `Fond de plan « ${baseMap.name} » non créé : ${errorMessage(e)}`
            );
          }
        }

        const failures = [];
        const pageResources = await ensurePdfPageResources({
          pdfFile,
          pdfDocument,
          pageNumbers: rendered.map((r) => r.baseMap.source.pageNumber),
          projectId: project.id,
          createdBy,
          failures,
        });
        if (failures.length > 0)
          errors.push(
            `PDF « ${path} » non conservé : la régénération depuis le PDF ne sera pas disponible.`
          );

        for (const item of rendered) {
          const { pageNumber, bboxInRatio } = item.baseMap.source;
          const resource = pageResources.get(pageNumber) ?? null;
          prepared.push({
            ...item,
            createdFrom: {
              type: "PDF_PAGE",
              pdfFileName: resource?.name ?? pdfFile.name ?? null,
              resourceId: resource?.id ?? null,
              pageNumber: resource
                ? (resource.pageInResource ?? 1)
                : pageNumber,
              sourcePageNumber: pageNumber,
              rotation: item.rotate,
              bboxInRatio: bboxInRatio ?? null,
              dpi: item.dpi ?? null,
              blueprintScale: item.baseMap.blueprintScale || null,
            },
          });
        }
      } finally {
        pdfDocument.destroy();
      }
    }

    // One call per base map, in the order of the json: a record always maps
    // to its payload entry, even when a neighbour fails.
    for (const item of prepared) {
      const listing =
        listingByKind[item.baseMap.listing] ??
        listingByKind.PLAN ??
        listings[0];
      if (!listing) {
        errors.push("Aucune liste de fonds de plan dans le projet.");
        break;
      }
      const [record] = await createBaseMaps(
        [
          {
            name: item.baseMap.name,
            imageFile: item.imageFile,
            meterByPx: item.meterByPx,
            createdFrom: item.createdFrom,
          },
        ],
        { listing }
      );
      if (!record) {
        errors.push(`Fond de plan « ${item.baseMap.name} » non créé.`);
        continue;
      }
      created.set(item.baseMap.id, {
        record,
        frame: {
          rotation: item.rotate,
          bboxInRatio: item.baseMap.source.bboxInRatio,
        },
        page: item.page,
      });
    }
    return created;
  }

  // helpers - scopes

  async function createListingTemplates({ listing, projectId }) {
    if (!listing.annotationTemplates.length) return 0;
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
    if (templateRecords.length) {
      await db.annotationTemplates.bulkAdd(templateRecords);
      dispatch(triggerAnnotationTemplatesUpdate());
    }
    return templateRecords.length;
  }

  async function importListingAnnotations({
    listing,
    annotations,
    target,
    coordinateSpace,
    projectId,
  }) {
    const { record, frame, page } = target;
    const imageSize = record.image?.imageSize ?? {
      width: record.refWidth,
      height: record.refHeight,
    };
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
    if (coordinateSpace === "pdf_user_space") {
      const converted = convertPayloadToImageSpace(payload, frame, page);
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
      createdBy: userEmail ?? null,
      dispatch,
    });
    return { placed: imported.placed?.length ?? 0, dropped };
  }

  async function createProjectScope({
    scope,
    project,
    baseMaps,
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
  }

  // main

  const create = useCallback(
    async ({ project, data, pdfFilesByPath }) => {
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
          const baseMaps = await createProjectBaseMaps({
            data,
            pdfFilesByPath,
            project: created,
            tick,
            errors,
          });
          counts.baseMaps = baseMaps.size;

          for (const scope of data.scopes) {
            try {
              await createProjectScope({
                scope,
                project: created,
                baseMaps,
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
