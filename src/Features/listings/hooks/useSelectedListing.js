import {useSelector} from "react-redux";

export default function useSelectedListing() {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const listingsMap = useSelector((s) => s.listings.listingsMap);

  // helpers

  const listing = listingsMap.get(selectedListingId);

  //

  return listing;
}
