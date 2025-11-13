import { useState, useEffect } from "react";

import { useSelector } from "react-redux";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useZonesTree() {
  const [loading, setLoading] = useState(true);

  const [zonesListing, setZonesListing] = useState(null);

  const zonesUpdatedAt = useSelector((s) => s.zones.zonesUpdatedAt);
  const appConfig = useAppConfig();

  function getZonesListing(listings) {
    const listingsWithEntityModel = listings.map((listing) => {
      const entityModel =
        appConfig?.entityModelsObject?.[listing?.entityModelKey] ?? null;
      return { ...listing, entityModel };
    });

    const listing = listingsWithEntityModel.find(
      (l) => l.entityModel?.type === "ZONE_ENTITY"
    );
    setZonesListing(listing);
  }

  const { value: listings, loading: loadingListings } = useListingsByScope();

  useEffect(() => {
    if (listings) {
      getZonesListing(listings);
    }
  }, [listings]);

  const zonesTree = useLiveQuery(async () => {
    console.log("[useZonesTree] new fetch");
    let tree = [];
    if (zonesListing?.id && zonesListing?.table) {
      setLoading(true);
      const item = await db[zonesListing.table]
        .where("listingId")
        .equals(zonesListing?.id)
        .first();
      tree = item?.zonesTree ?? [];
    }
    setLoading(false);
    return tree;
  }, [zonesListing?.id, zonesUpdatedAt]);

  return { value: zonesTree, loading };
}
