// Listing of a vertical base map created for a revolution axis (coupe of the
// profiles): the first listing that already holds vertical base maps, else
// the plan's own listing, else the first listing. Shared by the axes section
// of PopperMapListings (blank page dialog) and the overlay "Fond de plan"
// action (automatic A3 page).
export default function pickVerticalBaseMapListing({
  listings,
  verticalBaseMapGroups,
  planListingId,
}) {
  const all = listings ?? [];
  const verticalListingId = verticalBaseMapGroups?.[0]?.listing?.id;
  return (
    all.find((l) => l.id === verticalListingId) ??
    all.find((l) => l.id === planListingId) ??
    all[0] ??
    null
  );
}
