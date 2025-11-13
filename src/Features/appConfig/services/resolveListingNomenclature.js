import addIdToNodes from "Features/tree/utils/addIdToNodes";

export default async function resolveListingNomenclature(listing, appConfig) {
  // helpers

  const _nomenclature = listing?.metadata?.nomenclature;

  // edge case
  if (listing?.type !== "NOMENCLATURE" || !_nomenclature) return listing;

  // main
  const { srcKey, srcType } = _nomenclature;

  let nomenclature = {};
  if (srcType === "ORGA_DATA") {
    //const orgaData = await db.orgaData.get(srcKey);
    //nomenclature = orgaData.data;
    const url = appConfig.orgaData[srcKey].url;
    const result = await fetch(url);
    nomenclature = await result.json();
    nomenclature = {
      ...nomenclature,
      listingId: listing.id,
      items: addIdToNodes(nomenclature.items),
    };
  }

  // result
  return { ...listing, metadata: { ...listing.metadata, nomenclature } };
}
