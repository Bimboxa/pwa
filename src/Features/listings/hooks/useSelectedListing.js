import { useSelector } from "react-redux";
import useListingById from "./useListingById";

export default function useSelectedListing() {
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const listing = useListingById(selectedListingId);

  return { value: listing };
}
