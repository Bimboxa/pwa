import useCreateListings from "./useCreateListings";
import useResolvedPresetListings from "./useResolvedPresetListings";

export default function useCreateListingsFromPresetListingsKeys() {
  // data

  const createListings = useCreateListings();

  const resolvedPresetListings = useResolvedPresetListings();

  const create = async ({ presetListingsKeys }) => {
    let listings = resolvedPresetListings.filter(({ key }) =>
      presetListingsKeys.includes(key)
    );

    listings = await createListings({ listings });

    return listings;
  };
  return create;
}
