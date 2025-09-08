import { useSelector } from "react-redux";
import useListingsByScope from "./useListingsByScope";
import useListingById from "./useListingById";

export default function useSelectedListing(options) {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const listing = useListingById(selectedListingId);

  return { value: listing };
}
