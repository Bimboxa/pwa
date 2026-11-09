import { useCallback, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";

import { setSelectedProjectKeyInDashboard } from "Features/dashboard/dashboardSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useCreateProjectWithDefaultListings from "Features/projects/hooks/useCreateProjectWithDefaultListings";
import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useImportPromptIaContent from "./useImportPromptIaContent";

import createScopeConfig from "Features/scopeConfig/services/createScopeConfig";
import resolveConfigurationScopeConfig from "Features/scopeCreator/utils/resolveConfigurationScopeConfig";
import EMPTY_SCOPE_CONFIGURATION from "Features/scopeCreator/data/emptyScopeConfiguration";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import {
  countPromptIaImportTasks,
  createImportCounts,
} from "../utils/promptIaImportTasks";

const errorMessage = (e) => e?.message ?? String(e);

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
 * The import itself (base maps, placements, documents, scope content) is
 * shared with the "Prompt IA" Krto configuration: useImportPromptIaContent.
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

  const createProject = useCreateProjectWithDefaultListings();
  const createScope = useCreateScope();
  const { importProjectContent, importScopeContent } =
    useImportPromptIaContent();

  // state

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, step: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);

  // helpers

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

    // Same setup as the "Krto vide" button: core modules only. The row
    // precedes the scope (see useCreateScopeFromPreset).
    await createScopeConfig({
      scopeId: scope.id,
      projectId: project.id,
      appConfig,
      ...resolveConfigurationScopeConfig(
        EMPTY_SCOPE_CONFIGURATION.scopeConfig,
        appConfig
      ),
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

    await importScopeContent({
      scope,
      projectId: project.id,
      data,
      baseMaps,
      documents,
      tick,
      errors,
      counts,
    });
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

      // + 1: the project row
      const total = 1 + countPromptIaImportTasks(data);
      let done = 0;
      const tick = (step) => {
        done = Math.min(done + 1, total);
        setProgress({ done, total, step });
      };
      setProgress({ done: 0, total, step: "Projet" });

      const errors = [];
      const counts = createImportCounts();

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

          const { baseMaps, documents, destroy } = await importProjectContent({
            projectId: created.id,
            data,
            pdfFilesByPath,
            referenceImageFile,
            documentFilesByPath,
            tick,
            errors,
            counts,
          });

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
            destroy();
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
      createProject,
      createScope,
      importProjectContent,
      importScopeContent,
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
