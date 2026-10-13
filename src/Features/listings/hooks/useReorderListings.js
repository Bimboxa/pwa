import { useDispatch } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";
import { arrayMove } from "@dnd-kit/sortable";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import useLinkedListings from "Features/listings/hooks/useLinkedListings";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// useReorderListings — dnd-kit `onDragEnd` handler of the sortable listing
// lists (LISTE ACTIVE menu, "Listes" side of the popper): moves the dragged
// listing in the displayed order and rewrites the `rank` of every displayed
// listing (fractional indexing, the field the listings selector sorts on).
// Linked listings (other scope) are never ranked from here: their rank
// belongs to the source scope's order (and their row is not sortable anyway
// — the selector appends them after the own ones).
// ---------------------------------------------------------------------------

export default function useReorderListings() {
  const dispatch = useDispatch();

  // data

  const { isLinkedListing } = useLinkedListings();

  // handler

  return async function reorderListings({ active, over }, listings) {
    if (!active || !over || active.id === over.id) return;
    try {
      const oldIdx = (listings ?? []).findIndex((l) => l.id === active.id);
      const newIdx = (listings ?? []).findIndex((l) => l.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...listings], oldIdx, newIdx);
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
