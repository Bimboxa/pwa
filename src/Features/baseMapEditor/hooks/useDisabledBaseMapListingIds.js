import { useCallback } from "react";

import { useSelector } from "react-redux";

import {
  selectDisabledBaseMapListingIds,
  selectDisabledBaseMapListingIdsSynced,
} from "Features/scopes/selectors/selectDisabledBaseMapListingIds";

import db, { withSystemWrite } from "App/db/db";

// Per-scope list of BASE_MAP listing ids (folders) hidden in the scope: the
// eye of the SCOPE module's content panel. A hidden folder, its base maps and
// the annotations hosted on them are left out everywhere (useBaseMaps /
// useAnnotationsV2 apply the rule by default).
// Stored on the scope record (scope.baseMapsSettings.disabledListingIds) so it
// travels with Krto exports and scope duplication, like mesh3dSettings. Read
// from the Redux mirror of db.scopes (no live query per mount).
export default function useDisabledBaseMapListingIds() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const disabledListingIds = useSelector(selectDisabledBaseMapListingIds);
  // EMPTY is also returned while the scope row is not mirrored yet: consumers
  // that must not act on a not-yet-loaded scope wait on `synced`.
  const synced = useSelector(selectDisabledBaseMapListingIdsSynced);

  const toggleListingDisabled = useCallback(
    async (listingId) => {
      if (!scopeId || !listingId) return;
      const current =
        (await db.scopes.get(scopeId))?.baseMapsSettings?.disabledListingIds ??
        [];
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];
      // System write: hiding a folder is open to any editor of the scope, not
      // just its creator (scopes rows are ownership-guarded).
      await withSystemWrite(() =>
        db.scopes.update(scopeId, {
          "baseMapsSettings.disabledListingIds": next,
        })
      );
    },
    [scopeId]
  );

  return { scopeId, disabledListingIds, synced, toggleListingDisabled };
}
