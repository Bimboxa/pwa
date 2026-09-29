import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedListingId,
  setHiddenListingsIds,
} from "Features/listings/listingsSlice";

import { setAnnotationTemplatesHidden } from "Features/scopeVisibility/scopeVisibilitySlice";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// useSelectActiveListing — shared "select the active listing" logic of the
// LISTE ACTIVE field and the listing avatars bar: selects the listing, always
// unhides it, and with "Visibilité auto" hides every other listing of the
// panel while unhiding all the templates of the selected one.
// `options.hideOthers` overrides "Visibilité auto" for the listings part:
// false = never touch the other listings, true = always hide them.
// ---------------------------------------------------------------------------

export default function useSelectActiveListing(listings) {
  const dispatch = useDispatch();

  // data

  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const autoVisibility = useSelector(
    (s) => s.panelDrawing.autoListingVisibility
  );

  // handler

  const selectListing = async (listingId, options) => {
    const hideOthers = options?.hideOthers ?? Boolean(autoVisibility);

    dispatch(setSelectedListingId(listingId));

    if (!hideOthers) {
      // Even without hiding the others, selecting a listing always unhides it.
      if (hiddenListingsIds.includes(listingId))
        dispatch(
          setHiddenListingsIds(
            hiddenListingsIds.filter((id) => id !== listingId)
          )
        );
      return;
    }

    // Hide every other listing of the panel (hidden ids from other scopes
    // are preserved).
    const panelIds = (listings ?? []).map((l) => l.id);
    const keptHiddenIds = hiddenListingsIds.filter(
      (id) => !panelIds.includes(id)
    );
    dispatch(
      setHiddenListingsIds([
        ...keptHiddenIds,
        ...panelIds.filter((id) => id !== listingId),
      ])
    );

    // Auto visibility also unhides all the templates of the selected listing.
    if (!autoVisibility) return;

    // (per-scope local state, scopeVisibility slice — no template write)
    const templates = await db.annotationTemplates
      .where("listingId")
      .equals(listingId)
      .toArray();
    dispatch(
      setAnnotationTemplatesHidden({
        ids: templates.filter((t) => !t.deletedAt).map((t) => t.id),
        hidden: false,
      })
    );
  };

  return selectListing;
}
