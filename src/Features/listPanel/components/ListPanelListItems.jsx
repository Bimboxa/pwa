import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function ListPanelListItems() {
  // data

  const selectedListing = useSelectedListing();
  const entityModel = useListingEntityModel(selectedListing);

  //
  return <Box></Box>;
}
