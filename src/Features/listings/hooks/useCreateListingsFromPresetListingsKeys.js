import { useSelector } from "react-redux";

import useListings from "./useListings";
import useCreateListings from "./useCreateListings";
import useResolvedPresetListings from "./useResolvedPresetListings";

export default function useCreateListingsFromPresetListingsKeys() {
  // data

  const createListings = useCreateListings();
  const filterByProjectId = useSelector((s) => s.projects.selectedProjectId);
  const projectListings = useListings({ filterByProjectId });
  const projectListingsKeys = projectListings?.map((l) => l.key);

  const resolvedPresetListings = useResolvedPresetListings();

  const create = async ({ presetListingsKeys }) => {
    let listings = resolvedPresetListings.filter(({ key }) =>
      presetListingsKeys.includes(key)
    );

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

    listings = await createListings({ listings });

    return listings;
  };
  return create;
}
