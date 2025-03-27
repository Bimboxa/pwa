import {useSelector} from "react-redux";
import useListingsByScope from "./useListingsByScope";

export default function useSelectedListing(options) {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const {value: listings, loading} = useListingsByScope(options);

  const listing = listings?.find((l) => l?.id === selectedListingId);

  return {value: listing, loading};
}
