// Groups of the sheets laid on the table: one per base maps folder (listing),
// in the folders' order, then the base maps without a (known) folder, then
// the blocks base maps (Features/blocks) — whatever their folder. Pure.
//
// baseMaps: the base maps of the table, in display order.
// listings: the base maps folders, in display order.
// ensureListingIds: folders that get a group even when empty (the ones
//   offering a "+" frame).
// Returns [{ id, name, listingId, baseMaps }] — `listingId` null for the
// « Autres » / « Blocs » groups.
export const BASE_MAPS_GRID_OTHERS_GROUP_ID = "__OTHERS__";
export const BASE_MAPS_GRID_BLOCKS_GROUP_ID = "__BLOCKS__";

export default function getBaseMapsGridGroups({
  baseMaps,
  listings,
  ensureListingIds,
  othersLabel = "Autres",
  blocksLabel = "Blocs",
}) {
  const byListingId = new Map();
  const others = [];
  const blocks = [];
  const knownListingIds = new Set((listings ?? []).map((l) => l.id));

  (baseMaps ?? []).forEach((baseMap) => {
    if (baseMap.isBlocksBaseMap) blocks.push(baseMap);
    else if (knownListingIds.has(baseMap.listingId)) {
      if (!byListingId.has(baseMap.listingId))
        byListingId.set(baseMap.listingId, []);
      byListingId.get(baseMap.listingId).push(baseMap);
    } else others.push(baseMap);
  });

  const ensured = new Set(ensureListingIds ?? []);
  const groups = [];
  (listings ?? []).forEach((listing) => {
    if (!byListingId.has(listing.id) && !ensured.has(listing.id)) return;
    groups.push({
      id: listing.id,
      name: listing.name ?? "",
      listingId: listing.id,
      baseMaps: byListingId.get(listing.id) ?? [],
    });
  });
  if (others.length > 0) {
    groups.push({
      id: BASE_MAPS_GRID_OTHERS_GROUP_ID,
      name: othersLabel,
      listingId: null,
      baseMaps: others,
    });
  }
  if (blocks.length > 0) {
    groups.push({
      id: BASE_MAPS_GRID_BLOCKS_GROUP_ID,
      name: blocksLabel,
      listingId: null,
      baseMaps: blocks,
    });
  }
  return groups;
}
