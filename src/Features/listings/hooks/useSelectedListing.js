import {useSelector} from "react-redux";

export default function useSelectedListing() {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  return useSelector((s) => s.listings.listingsMap.get(selectedListingId));
}
