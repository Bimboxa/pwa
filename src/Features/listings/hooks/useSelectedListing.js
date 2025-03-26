import {useSelector} from "react-redux";
import useListingsByScope from "./useListingsByScope";

export default function useSelectedListing() {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const {value: listings, loading} = useListingsByScope();

  const listing = listings?.find((l) => l.id === selectedListingId);

  console.log("[useSelectedListing] selectedI", selectedListingId);
  return {value: listing, loading};
}
