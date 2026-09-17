import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedListingId,
  setHiddenListingsIds,
} from "Features/listings/listingsSlice";

import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";

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

  const updateAnnotationTemplates = useUpdateAnnotationTemplates();

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

    const templates = await db.annotationTemplates
      .where("listingId")
      .equals(listingId)
      .toArray();
    await updateAnnotationTemplates(
      templates
        .filter((t) => !t.deletedAt && t.hidden)
        .map((t) => ({ id: t.id, hidden: false }))
    );
  };

  return selectListing;
}
