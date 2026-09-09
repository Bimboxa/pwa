import { useDispatch } from "react-redux";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import db from "App/db/db";
import useCanEditRecord from "App/hooks/useCanEditRecord";

import { getStateModels } from "../utils/notesAppStateModels";

// Empty Krnet configuration block of a listing never linked / configured.
export const EMPTY_NOTES_APP_CONFIG = {
  settings: {},
  stateModels: [],
  entityModelId: null,
  icon: null,
  color: null,
  remoteUpdatedAt: 0,
  localUpdatedAt: null,
};

// Single write path of the Krnet configuration of a listing: ownership
// guard, fresh read (another edit may have landed since the panel rendered),
// mutation, then db.listings.update with notesApp.localUpdatedAt stamped —
// the stamp the pull conflict rule and the push selection rely on. A normal
// user write: undoable, audited, ownership-guarded in db.js.
export default function useUpdateListingNotesAppConfig(listing) {
  const dispatch = useDispatch();
  const { guardEditRecord } = useCanEditRecord();

  async function mutateNotesApp(mutator) {
    if (!listing?.id || !guardEditRecord(listing)) return null;
    const fresh = await db.listings.get(listing.id);
    if (!fresh || fresh.deletedAt) return null;
    const current = { ...EMPTY_NOTES_APP_CONFIG, ...(fresh.notesApp ?? {}) };
    const next = mutator(current) ?? current;
    const notesApp = { ...next, localUpdatedAt: new Date().toISOString() };
    await db.listings.update(listing.id, { notesApp });
    dispatch(triggerListingsUpdate());
    return notesApp;
  }

  function updateSettings(mutator) {
    return mutateNotesApp((n) => ({
      ...n,
      settings: mutator(n.settings ?? {}),
    }));
  }

  function updateStateModels(mutator) {
    return mutateNotesApp((n) => ({
      ...n,
      stateModels: mutator(
        getStateModels({ notesApp: n }, { includeDeleted: true })
      ),
    }));
  }

  function updateStateModel(stateModelId, mutator) {
    return updateStateModels((sms) =>
      sms.map((sm) => (sm.id === stateModelId ? mutator(sm) : sm))
    );
  }

  return {
    mutateNotesApp,
    updateSettings,
    updateStateModels,
    updateStateModel,
  };
}
