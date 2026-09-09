import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItem,
} from "Features/selection/selectionSlice";

// Default selection of a business-objects module: with nothing selected, the
// module's ACTIVE LISTING is selected, so the right panel shows the listing
// properties (PanelBusinessObjectListingProperties) instead of an empty
// panel. Re-arms after every emptying — Escape, a click on empty canvas, the
// selection reset performed when entering the module (selectionSlice case on
// setSelectedViewerKey) — so the module always falls back to its listing.
//
// `listing` MUST be the panel's resolved active listing (filtered by the
// module's type), never s.businessObjects.selectedListingId raw: that slot is
// shared by the three business-object modules and can point at another
// module's listing for a frame after a module switch.
export default function useDefaultSelectionInBusinessObjectsModule(listing) {
  const dispatch = useDispatch();

  const selectedItems = useSelector(selectSelectedItems);

  const listingId = listing?.id ?? null;
  const isEmpty = selectedItems.length === 0;

  useEffect(() => {
    if (!listingId || !isEmpty) return;
    dispatch(setSelectedItem({ id: listingId, type: "LISTING", listingId }));
  }, [listingId, isEmpty, dispatch]);
}
