import db, { withSystemWrite } from "App/db/db";

/*
 * Set the per-scope list of BASE_MAP listing ids hidden from the base map
 * selectors (scope.baseMapsSettings.disabledListingIds — same storage as
 * useDisabledBaseMapListingIds). Used at scope creation time, where the
 * toggle hook (bound to the selected scope) cannot be used.
 */
export default async function setDisabledBaseMapListingIds({
  scopeId,
  listingIds,
}) {
  if (!scopeId || !Array.isArray(listingIds)) return;

  // System write: scopes rows are ownership-guarded; this setting is a
  // navigation convenience open to any editor of the scope.
  await withSystemWrite(() =>
    db.scopes.update(scopeId, {
      "baseMapsSettings.disabledListingIds": listingIds,
    })
  );
}
