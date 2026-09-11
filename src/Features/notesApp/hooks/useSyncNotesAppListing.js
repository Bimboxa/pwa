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
import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

import syncNotesAppListing from "../services/syncNotesAppListing";

// Wraps the per-listing pull with UI state: a local "syncing" flag (the
// slice syncStatus stays the scope pull's), toaster recap, annotations /
// objects / listings refresh. Reads the scope row fresh from Dexie.
export default function useSyncNotesAppListing() {
  const dispatch = useDispatch();

  const appConfig = useAppConfig();
  const userProfile = useSelector((s) => s.auth.userProfile);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const [syncingId, setSyncingId] = useState(null);

  function getRecapMessage(counts) {
    const parts = [];
    if (counts.created) parts.push(`${counts.created} ouvrage(s) créé(s)`);
    if (counts.updated) {
      parts.push(`${counts.updated} ouvrage(s) mis à jour`);
    }
    if (counts.deleted) {
      parts.push(`${counts.deleted} ouvrage(s) supprimé(s)`);
    }
    if (counts.related) parts.push(`${counts.related} objet(s) lié(s)`);
    if (counts.notes) parts.push(`${counts.notes} note(s)`);
    if (counts.links) parts.push(`${counts.links} lien(s)`);
    if (counts.positions) parts.push(`${counts.positions} position(s)`);
    if (counts.shapes) parts.push(`${counts.shapes} forme(s)`);
    if (counts.config) parts.push("configuration mise à jour");
    if (counts.relatedIgnored) {
      parts.push(
        `${counts.relatedIgnored} objet(s) lié(s) hors listes mappées`
      );
    }
    if (parts.length === 0) return "Liste déjà à jour";
    return `Données récupérées : ${parts.join(", ")}`;
  }

  function getErrorMessage(e) {
    switch (e?.code) {
      case "NOTES_APP_NOT_SIGNED_IN":
        return "Connectez-vous à Krnet pour récupérer les données";
      case "NOTES_APP_LISTING_NOT_LINKED":
        return "Liste non liée à une liste Krnet";
      case "NOTES_APP_LISTING_NOT_FOUND":
        return "Liste introuvable dans Krnet";
      case "NOTES_APP_LISTING_DELETED":
        return "Liste supprimée dans Krnet : lancez la synchronisation du dossier";
      default:
        return `Echec de la récupération : ${e?.message ?? e}`;
    }
  }

  async function syncListing(listing) {
    if (!listing?.id || syncingId) return null;
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

    setSyncingId(listing.id);
    try {
      const result = await syncNotesAppListing({
        listing,
        scope,
        appConfig,
        userIdMaster,
      });
      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());
      dispatch(triggerBusinessObjectsUpdate());
      dispatch(triggerRelsBusinessObjectAnnotationUpdate());
      dispatch(triggerListingsUpdate());
      dispatch(setToaster({ message: getRecapMessage(result.counts) }));
      return result;
    } catch (e) {
      console.error("[notesApp] listing pull failed", e);
      dispatch(setToaster({ message: getErrorMessage(e), isError: true }));
      return null;
    } finally {
      setSyncingId(null);
    }
  }

  return { syncListing, syncing: Boolean(syncingId), syncingId };
}
