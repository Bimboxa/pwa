import { useDispatch, useSelector } from "react-redux";

import { selectDisabledAnnotationListingIds } from "Features/listings/selectors/selectDisabledAnnotationListingIds";

import { generateKeyBetween } from "fractional-indexing";
import { arrayMove } from "@dnd-kit/sortable";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// useReorderListings — dnd-kit `onDragEnd` handler of the sortable listing
// lists (LISTE ACTIVE menu, listings panel of the popper): moves the dragged
// listing in the displayed order and rewrites the `rank` of every displayed
// listing (fractional indexing, the field the listings selector sorts on).
// Linked listings (other scope) are never ranked from here: their rank
// belongs to the source scope's order (and their row is not sortable anyway
// — the selector appends them after the own ones).
// Listings disabled in the scope (eye of the SCOPE « Contenu » tab) are not
// displayed but keep their slot: the move is applied to the displayed
// listings plus the disabled ones, in the scope order, so ranking the
// displayed ones never makes them collide with the hidden ones' ranks.
// ---------------------------------------------------------------------------

export default function useReorderListings() {
  const dispatch = useDispatch();

  // data

  const { isLinkedListing } = useLinkedListings();
  const disabledIds = useSelector(selectDisabledAnnotationListingIds);
  const { value: scopeListings } = useListingsByScope({
    includeDisabledListings: true,
  });

  // helpers

  function withDisabledListings(listings) {
    if (!disabledIds.length) return listings;
    const ids = new Set([...listings.map((l) => l.id), ...disabledIds]);
    const full = (scopeListings ?? []).filter((l) => ids.has(l.id));
    // Displayed listings missing from the scope list (none expected) would
    // be lost: fall back to the displayed order.
    return full.length >= listings.length ? full : listings;
  }

  // handler

  return async function reorderListings({ active, over }, listings) {
    if (!active || !over || active.id === over.id) return;
    try {
      const all = withDisabledListings(listings ?? []);
      const oldIdx = all.findIndex((l) => l.id === active.id);
      const newIdx = all.findIndex((l) => l.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...all], oldIdx, newIdx);
      let prev = null;
      const updates = [];
      for (const l of reordered) {
        if (isLinkedListing(l.id)) continue;
        const rank = generateKeyBetween(prev, null);
        updates.push(db.listings.update(l.id, { rank }));
        prev = rank;
      }
      await Promise.all(updates);
      dispatch(triggerListingsUpdate());
    } catch (e) {
      console.error("[useReorderListings] DnD reorder error:", e);
    }
  };
}
