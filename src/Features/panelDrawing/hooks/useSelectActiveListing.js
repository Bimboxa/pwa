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

  const selectListing = async (listingId) => {
    dispatch(setSelectedListingId(listingId));

    if (!autoVisibility) {
      // Even without auto visibility, selecting a listing always unhides it.
      if (hiddenListingsIds.includes(listingId))
        dispatch(
          setHiddenListingsIds(
            hiddenListingsIds.filter((id) => id !== listingId)
          )
        );
      return;
    }

    // Auto visibility: hide every other listing of the panel (hidden ids
    // from other scopes are preserved) and unhide all the templates of the
    // selected listing.
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
