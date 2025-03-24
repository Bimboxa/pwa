import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "./useListingEntityModel";

export default function useEntityModel() {
  // data

  const listing = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  return entityModel;
}
