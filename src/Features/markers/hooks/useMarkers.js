import {useSelector} from "react-redux";

import db from "App/db/db";
import {useLiveQuery} from "dexie-react-hooks";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import {useState} from "react";

export default function useMarkers(options) {
  // options

  const filterByMapId = options?.filterByMapId;
  const filterByListingsIds = options?.filterByListingsIds;

  // hash

  const hash1 = filterByMapId ? filterByMapId : "";
  const hash2 = Array.isArray(filterByListingsIds)
    ? filterByListingsIds.sort().join(",")
    : "";
  const hash = `${hash1}-${hash2}`;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const markersUpdatedAt = useSelector((s) => s.markers.markersUpdatedAt);
  const {value: listings, loading: loadingListings} = useListingsByScope();

  // helpers

  const listingById = !listings
    ? {}
    : listings.reduce((acc, listing) => {
        if (listing?.id) {
          acc[listing.id] = listing;
        }
        return acc;
      }, {});

  // helpers

  const markers = useLiveQuery(async () => {
    // edge case
    if (loadingListings) return [];

    // main
    setLoading(true);
    if (filterByMapId && filterByListingsIds) {
      let markers = await db.markers
        .where("mapId")
        .equals(filterByMapId)
        .toArray();
      markers = markers.filter((m) =>
        filterByListingsIds.includes(m.listingId)
      );

      // add color
      markers = markers.map((m) => {
        const listing = listingById?.[m.listingId];
        if (listing) {
          m.color = listing.color;
        }
        return m;
      });

      // return
      setLoading(false);
      return markers;
    } else {
      return [];
    }
  }, [markersUpdatedAt, hash, loadingListings]);

  // const markersMap = useSelector((s) => s.markers.markersMap);

  // let markers = Object.values(markersMap);

  // if (filterByMapId) {
  //   markers = markers.filter((m) => m.mapId === filterByMapId);
  // }

  return {value: markers, loading};
}
