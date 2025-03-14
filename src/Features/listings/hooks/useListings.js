import {useSelector} from "react-redux";

export default function useListings(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;

  // data

  const listingsMap = useSelector((s) => s.listings.listingsMap);
  //

  let listings = Array.from(listingsMap.values());

  // filters

  if (filterByProjectId) {
    listings = listings.filter(
      (listing) => listing.projectId === filterByProjectId
    );
  }

  return listings;
}
