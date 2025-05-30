import resolveListingNomenclature from "./resolveListingNomenclature";

export default async function resolveOrgaListingsFromAppConfig(appConfig) {
  let listings = Object.values(appConfig?.presetListingsObject ?? {});

  // filter on isOrgaData
  listings = listings?.filter((l) => l.isOrgaData);

  // resolve
  listings = await Promise.all(
    listings.map(async (listing) => {
      if (listing.type === "NOMENCLATURE") {
        return await resolveListingNomenclature(listing);
      } else {
        return listing;
      }
    })
  );

  return listings;
}
