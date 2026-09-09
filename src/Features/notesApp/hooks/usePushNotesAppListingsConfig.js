import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import db from "App/db/db";

import pushNotesAppListingsConfig from "../services/pushNotesAppListingsConfig";

// Wraps the listing-configuration push with UI state (toaster, listings
// refresh). Reads the scope row fresh so the mapping is never stale.
export default function usePushNotesAppListingsConfig() {
  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  return async function pushConfig({ listingIds = null, force = false } = {}) {
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
    try {
      const result = await pushNotesAppListingsConfig({
        scope,
        listingIds,
        force,
      });
      dispatch(triggerListingsUpdate());
      const n = result.counts.listings;
      dispatch(
        setToaster({
          message:
            n === 0
              ? "Configuration déjà à jour dans Krnet"
              : `Configuration envoyée vers Krnet : ${n} liste(s)`,
        })
      );
      return result;
    } catch (e) {
      console.error("[notesApp] listings config push failed", e);
      const message =
        e?.code === "NOTES_APP_NOT_SIGNED_IN"
          ? "Connectez-vous à Krnet pour envoyer la configuration"
          : `Echec de l'envoi : ${e.message ?? e}`;
      dispatch(setToaster({ message, isError: true }));
      return null;
    }
  };
}
