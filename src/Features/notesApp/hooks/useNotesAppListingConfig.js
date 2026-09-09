import { useMemo } from "react";

import {
  getNotesAppSettings,
  getFields,
  getAutoCodeConfig,
} from "../utils/notesAppListingSettings";
import { getStateModels } from "../utils/notesAppStateModels";
import { isListingConfigDirty } from "../utils/getNotesAppListingConfigSignature";

// Derived, memoized view of a listing's Krnet configuration
// (listing.notesApp): parsed settings, live fields, non-deleted state
// models, link / dirty status and the summary of the entry card.
export default function useNotesAppListingConfig(listing) {
  const notesApp = listing?.notesApp ?? null;

  return useMemo(() => {
    const settings = getNotesAppSettings(listing);
    const fields = getFields(settings);
    const allStateModels = getStateModels(listing, { includeDeleted: true });
    const stateModels = allStateModels.filter((sm) => !sm.deletedAt);
    const autoCode = getAutoCodeConfig(settings);
    return {
      notesApp,
      settings,
      fields,
      stateModels,
      allStateModels,
      stateModelById: Object.fromEntries(
        allStateModels.map((sm) => [sm.id, sm])
      ),
      autoCode,
      isLinked: Boolean(listing?.idMaster),
      isDirty: isListingConfigDirty(listing),
      summary: {
        fieldsCount: fields.length,
        stateModelsCount: stateModels.length,
        autoCodeEnabled: Boolean(autoCode),
      },
    };
  }, [notesApp, listing?.idMaster]);
}
