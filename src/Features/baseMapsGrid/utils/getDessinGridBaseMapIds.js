// Sheets of the Dessin module's base maps grid (2D table and 3D table alike):
// EVERY base map of the scope — `baseMaps` as useBaseMaps returns them (the
// folders hidden in the scope and the detail base maps are already out) —
// in the order of the folders (`listings`, ranked as the Fonds de plan
// list) then the base maps' own order. Pure.
export default function getDessinGridBaseMapIds({ baseMaps, listings }) {
  if (!baseMaps?.length) return [];
  const rankByListingId = {};
  listings?.forEach((listing, index) => {
    rankByListingId[listing.id] = index;
  });
  return baseMaps
    .map((baseMap, index) => ({ baseMap, index }))
    .sort(
      (a, b) =>
        (rankByListingId[a.baseMap.listingId] ?? Infinity) -
          (rankByListingId[b.baseMap.listingId] ?? Infinity) ||
        a.index - b.index
    )
    .map(({ baseMap }) => baseMap.id);
}
