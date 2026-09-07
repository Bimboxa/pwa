import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectKeyInDashboard } from "Features/dashboard/dashboardSlice";
import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import loadProjectExportZip from "../services/loadProjectExportZip";
import deleteProjectLocalDataService from "../services/deleteProjectLocalDataService";

// Dashboard ".zip" button, project-export branch.
//
// - wipeExisting (verbatim mode only): the local copy of the project is
//   hard-wiped first (deleteProjectLocalDataService) so the import is an
//   exact replica of the dump — rows created locally after the export cannot
//   survive. The app selection is reset BEFORE the wipe, like
//   PanelDashboardProjectDetail.handleDeleteLocalData, so live components
//   stop reading rows about to vanish.
// - afterwards the imported project is selected in the dashboard (the items
//   list is live, no refresh needed).
export default function useImportProjectExportZip() {
  const dispatch = useDispatch();

  // data

  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function importProjectZip({ file, manifest, duplicate, wipeExisting }) {
    setLoading(true);
    try {
      if (!duplicate && wipeExisting && manifest?.projectId) {
        const projectId = manifest.projectId;
        const scopeIds = (
          await db.scopes.where("projectId").equals(projectId).primaryKeys()
        ).map(String);
        if (String(selectedProjectId) === String(projectId)) {
          dispatch(setSelectedProjectId(null));
        }
        if (scopeIds.includes(String(selectedScopeId))) {
          dispatch(setSelectedScopeId(null));
        }
        dispatch(setSelectedProjectKeyInDashboard(null));
        await deleteProjectLocalDataService(projectId);
      }

      const { project } = await loadProjectExportZip(file, { duplicate });

      dispatch(setSelectedProjectKeyInDashboard(`local_${project.id}`));
      dispatch(setOnboardingIsActive(false));
      dispatch(
        setToaster({
          message: `Projet "${project.name ?? project.id}" chargé`,
          severity: "success",
        })
      );
      return project;
    } catch (error) {
      console.error("[useImportProjectExportZip] import error", error);
      dispatch(
        setToaster({
          message: `Échec du chargement : ${error.message || "erreur inconnue"}`,
          severity: "error",
        })
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { importProjectZip, loading };
}
