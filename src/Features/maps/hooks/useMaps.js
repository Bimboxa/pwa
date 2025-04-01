import {useState} from "react";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useEntities from "Features/entities/hooks/useEntities";

export default function useMaps() {
  // data

  const {value: listings, loading: loadingListings} = useListingsByScope({
    mapsOnly: true,
  });

  // helpers

  const listingsIds = listings?.map((l) => l.id);

  // data

  return useEntities({filterByListingsIds: listingsIds});
}
