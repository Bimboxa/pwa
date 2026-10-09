import { useSelector } from "react-redux";

import useListings from "./useListings";
import useCreateListings from "./useCreateListings";
import useResolvedPresetListings from "./useResolvedPresetListings";

export default function useCreateListingsFromPresetListingsKeys() {
  // data

  const createListings = useCreateListings();
  const filterByProjectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: projectListings } = useListings({ filterByProjectId });
  const projectListingsKeys = projectListings?.map((l) => l.key);

  const resolvedPresetListings = useResolvedPresetListings();

  // overridesByKey: { [presetKey]: { name, avatarString } } — user edits made
  // before creation (DialogCreateListing). Only applies to the requested keys,
  // not to the annotationTemplates listings added as dependencies below.
  const create = async ({
    presetListingsKeys,
    scope,
    isForBaseMaps,
    overridesByKey,
  }) => {
    let listings = resolvedPresetListings.filter(({ key }) =>
      presetListingsKeys.includes(key)
    );

    listings = listings.map((listing) => {
      const override = overridesByKey?.[listing.key];
      if (!override) return listing;
      return {
        ...listing,
        name: override.name?.trim() || listing.name,
        avatarString: override.avatarString?.trim() || null,
      };
    });

    // annotationTemplates Listings
    const atlKeys = [];
    listings.forEach((listing) => {
      const ltk = listing.annotationTemplatesListingKey;
      if (ltk && !projectListingsKeys.includes(ltk)) {
        atlKeys.push(ltk);
      }
    });
    const atListings = resolvedPresetListings.filter(({ key }) =>
      atlKeys.includes(key)
    );

    listings = [...listings, ...atListings];

    if (isForBaseMaps) {
      listings = listings.map((l) => ({ ...l, isForBaseMaps: true }));
    }

    listings = await createListings({ listings, scope });

    return listings;
  };
  return create;
}
