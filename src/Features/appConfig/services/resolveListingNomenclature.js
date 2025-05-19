import db from "App/db/db";

export default async function resolveListingNomenclature(listing) {
  // helpers

  const _nomenclature = listing?.metadata?.nomenclature;

  // edge case
  if (listing?.type !== "NOMENCLATURE" || !_nomenclature) return listing;

  // main
  const {srcKey, srcType} = _nomenclature;

  let nomenclature = {};
  if (srcType === "ORGA_DATA") {
    const orgaData = await db.orgaData.get(srcKey);
    nomenclature = orgaData.data;
  }

  // result
  return {...listing, metadata: {...listing.metadata, nomenclature}};
}
