import { useCallback } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db, { withSystemWrite } from "App/db/db";

// Stable fallback so consumers can safely use the array in memo deps.
const EMPTY = [];

// Per-scope list of BASE_MAP listing ids hidden from the base map selectors
// (topbar selector, 3D chips band, elevation selector, portfolio popover).
// Stored on the scope record (scope.baseMapsSettings.disabledListingIds) so it
// travels with Krto exports and scope duplication, like mesh3dSettings.
export default function useDisabledBaseMapListingIds() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const scope = useLiveQuery(
    () => (scopeId ? db.scopes.get(scopeId) : null),
    [scopeId]
  );

  const disabledListingIds =
    scope?.baseMapsSettings?.disabledListingIds ?? EMPTY;

  const toggleListingDisabled = useCallback(
    async (listingId) => {
      if (!scopeId || !listingId) return;
      const current =
        (await db.scopes.get(scopeId))?.baseMapsSettings?.disabledListingIds ??
        [];
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];
      // System write: toggling is a navigation convenience open to any editor
      // of the scope, not just its creator (scopes rows are ownership-guarded).
      await withSystemWrite(() =>
        db.scopes.update(scopeId, {
          "baseMapsSettings.disabledListingIds": next,
        })
      );
    },
    [scopeId]
  );

  return { scopeId, disabledListingIds, toggleListingDisabled };
}
