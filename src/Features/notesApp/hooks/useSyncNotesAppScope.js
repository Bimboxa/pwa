import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "Features/businessObjects/businessObjectsSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { setNotesAppSyncStatus } from "../notesAppSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

import syncNotesAppScope from "../services/syncNotesAppScope";

// Wraps the pull orchestrator with UI state: slice sync status, toaster,
// annotations refresh. Reads the scope row fresh from Dexie so a link edited
// a moment ago is never stale.
export default function useSyncNotesAppScope() {
  const dispatch = useDispatch();

  const appConfig = useAppConfig();
  const { value: createdBy } = useUserEmail();
  const userProfile = useSelector((s) => s.auth.userProfile);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  return async function syncSelectedScope() {
    const scope = selectedScopeId ? await db.scopes.get(selectedScopeId) : null;
    if (!scope?.notesApp?.projectId) {
      dispatch(
        setToaster({
          message: "Aucun dossier Krnet lié à cette mission",
          isError: true,
        })
      );
      return null;
    }

    const rawUserIdMaster = getUserIdMaster(userProfile);
    const userIdMaster =
      rawUserIdMaster != null ? String(rawUserIdMaster) : "anonymous";

    dispatch(
      setNotesAppSyncStatus({ status: "syncing", step: "fetch", message: null })
    );
    try {
      const result = await syncNotesAppScope({
        scope,
        appConfig,
        userIdMaster,
        createdBy,
        onProgress: (progress) =>
          dispatch(setNotesAppSyncStatus({ status: "syncing", ...progress })),
      });

      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());
      dispatch(triggerBusinessObjectsUpdate());
      dispatch(triggerRelsBusinessObjectAnnotationUpdate());
      dispatch(triggerListingsUpdate());
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      dispatch(setNotesAppSyncStatus({ status: "success", step: null }));
      const c = result.counts;
      const extras = [];
      if (c.baseMapsMoved) extras.push(`${c.baseMapsMoved} plan(s) déplacé(s)`);
      if (c.baseMapsIgnored)
        extras.push(`${c.baseMapsIgnored} plan(s) ignoré(s)`);
      if (c.baseMapsSkipped)
        extras.push(`${c.baseMapsSkipped} plan(s) sans image`);
      const extrasS = extras.length ? ` (${extras.join(", ")})` : "";
      dispatch(
        setToaster({
          message: `Données récupérées : ${c.entities} ouvrage(s), ${c.baseMaps} plan(s)${extrasS}, ${c.positions} position(s), ${c.shapes} forme(s), ${c.listingsConfig} config(s) de liste`,
        })
      );
      return result;
    } catch (e) {
      console.error("[notesApp] sync failed", e);
      dispatch(
        setNotesAppSyncStatus({
          status: "error",
          message: e.message ?? String(e),
        })
      );
      const message =
        e?.code === "NOTES_APP_NOT_SIGNED_IN"
          ? "Connectez-vous à Krnet pour synchroniser"
          : `Echec de la synchronisation : ${e.message ?? e}`;
      dispatch(setToaster({ message, isError: true }));
      // best-effort status stamp on the scope link
      try {
        const fresh = await db.scopes.get(scope.id);
        if (fresh?.notesApp) {
          await db.scopes.update(scope.id, {
            notesApp: { ...fresh.notesApp, lastSyncStatus: "error" },
          });
        }
      } catch {
        // ignore
      }
      return null;
    }
  };
}
