import { useDispatch } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";
import { arrayMove } from "@dnd-kit/sortable";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import db from "App/db/db";

// Drag-reorder of the business-object listings of a module: rewrites the
// `rank` of every listing (fractional indexing, sequential keys) in the
// dropped order, then refreshes the listings. Returns the dnd-kit onDragEnd
// handler factory: `reorder(event, listings)`.
export default function useReorderBusinessObjectListings() {
  const dispatch = useDispatch();

  return async ({ active, over }, listings) => {
    if (!active || !over || active.id === over.id) return;
    try {
      const oldIdx = listings.findIndex((l) => l.id === active.id);
      const newIdx = listings.findIndex((l) => l.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove([...listings], oldIdx, newIdx);
      let prev = null;
      const updates = [];
      for (const l of reordered) {
        const rank = generateKeyBetween(prev, null);
        updates.push(db.listings.update(l.id, { rank }));
        prev = rank;
      }
      await Promise.all(updates);
      dispatch(triggerListingsUpdate());
    } catch (e) {
      console.error("[useReorderBusinessObjectListings] reorder error:", e);
    }
  };
}
