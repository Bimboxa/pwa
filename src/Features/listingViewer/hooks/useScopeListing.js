import { useSelector } from "react-redux";

import useListingById from "Features/listings/hooks/useListingById";

// Listing the SCOPE module is narrowed to: the app-wide selected listing,
// unless the panel is in its "Afficher toutes les listes" mode
// (listings.scopeModuleShowAllListings) — null then, while
// selectedListingId stays what it is for the rest of the app (Dessin draws
// into it, useAutoSelectListing would refill it at once).
// Returns { listing, showAllListings }.
export default function useScopeListing() {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const showAllListings = useSelector(
    (s) => s.listings.scopeModuleShowAllListings
  );
  const selectedListing = useListingById(selectedListingId);

  return {
    listing: showAllListings ? null : selectedListing,
    showAllListings,
  };
}
