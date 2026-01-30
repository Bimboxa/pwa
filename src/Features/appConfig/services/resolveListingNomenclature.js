import addIdToNodes from "Features/tree/utils/addIdToNodes";
import nomenclatureExample from "Features/nomenclatures/data/nomenclatureExample";

export default function resolveListingNomenclature(listing, appConfig) {
  // helpers

  const _nomenclature = listing?.metadata?.nomenclature;

  // edge case
  if (listing?.type !== "NOMENCLATURE" || !_nomenclature) return listing;

  // main
  const { srcKey, srcType } = _nomenclature;

  let nomenclature = {};
  if (srcType === "EXAMPLE") {
    nomenclature = nomenclatureExample;
  } else if (srcType === "ORGA_DATA") {
    //const orgaData = await db.orgaData.get(srcKey);
    //nomenclature = orgaData.data;
    // const url = appConfig.orgaData[srcKey].url;
    // const result = await fetch(url);
    // nomenclature = await result.json();
    nomenclature = appConfig.orgaData[srcKey];
  }

  // add id to nodes
  nomenclature = {
    ...nomenclature,
    listingId: listing.id,
    items: addIdToNodes(nomenclature.items),
  };

  // result
  return { ...listing, metadata: { ...listing.metadata, nomenclature } };
}
