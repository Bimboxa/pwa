import { useState } from "react";
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

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

import syncNotesAppBusinessObject from "../services/syncNotesAppBusinessObject";

// Wraps the per-object pull with UI state: a local "syncing" flag (the
// slice syncStatus stays the scope pull's), toaster recap, annotations /
// objects refresh. Reads the scope row fresh from Dexie.
export default function useSyncNotesAppBusinessObject() {
  const dispatch = useDispatch();

  const appConfig = useAppConfig();
  const userProfile = useSelector((s) => s.auth.userProfile);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const [syncingId, setSyncingId] = useState(null);

  function getRecapMessage(counts) {
    if (counts.entity === "deleted") {
      return "Objet supprimé dans Krnet : supprimé localement";
    }
    const parts = [
      counts.entity === "updated" ? "objet mis à jour" : "objet déjà à jour",
    ];
    if (counts.related) parts.push(`${counts.related} objet(s) lié(s)`);
    if (counts.notes) parts.push(`${counts.notes} note(s)`);
    if (counts.links) parts.push(`${counts.links} lien(s)`);
    if (counts.positions) parts.push(`${counts.positions} position(s)`);
    if (counts.shapes) parts.push(`${counts.shapes} forme(s)`);
    if (counts.relatedIgnored) {
      parts.push(
        `${counts.relatedIgnored} objet(s) lié(s) hors listes mappées`
      );
    }
    return `Données récupérées : ${parts.join(", ")}`;
  }

  function getErrorMessage(e) {
    switch (e?.code) {
      case "NOTES_APP_NOT_SIGNED_IN":
        return "Connectez-vous à Krnet pour récupérer les données";
      case "NOTES_APP_OBJECT_NOT_FOUND":
        return "Objet introuvable dans Krnet";
      case "NOTES_APP_OBJECT_MOVED":
        return "Objet déplacé dans une autre liste Krnet : lancez la synchronisation du dossier";
      default:
        return `Echec de la récupération : ${e?.message ?? e}`;
    }
  }

  async function syncBusinessObject(businessObject) {
    if (!businessObject?.id || syncingId) return null;
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

    setSyncingId(businessObject.id);
    try {
      const result = await syncNotesAppBusinessObject({
        businessObject,
        scope,
        appConfig,
        userIdMaster,
      });
      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());
      dispatch(triggerBusinessObjectsUpdate());
      dispatch(triggerRelsBusinessObjectAnnotationUpdate());
      dispatch(setToaster({ message: getRecapMessage(result.counts) }));
      return result;
    } catch (e) {
      console.error("[notesApp] business object pull failed", e);
      dispatch(setToaster({ message: getErrorMessage(e), isError: true }));
      return null;
    } finally {
      setSyncingId(null);
    }
  }

  return { syncBusinessObject, syncing: Boolean(syncingId), syncingId };
}
