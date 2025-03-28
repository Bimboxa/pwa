import {useState, useEffect} from "react";

import {useSelector} from "react-redux";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import getEntityModelAsync from "App/services/getEntityModel";

export default function useZonesTree() {
  const [loading, setLoading] = useState(true);

  const [zonesListing, setZonesListing] = useState(null);

  const zonesUpdatedAt = useSelector((s) => s.zones.zonesUpdatedAt);

  async function getZonesListing(listings) {
    const listingsWithEntityModel = await Promise.all(
      listings.map(async (listing) => {
        const entityModel = await getEntityModelAsync(listing.entityModelKey);
        return {...listing, entityModel};
      })
    );
    const listing = listingsWithEntityModel.find(
      (l) => l.entityModel?.type === "ZONE_ENTITY_MODEL"
    );
    setZonesListing(listing);
  }

  const {value: listings, loading: loadingListings} = useListingsByScope();

  useEffect(() => {
    if (listings) {
      getZonesListing(listings);
    }
  }, [listings]);

  const zonesTree = useLiveQuery(async () => {
    console.log("[useZonesTree] new fetch");
    let tree = [];
    if (zonesListing?.id) {
      setLoading(true);
      const item = await db.entities
        .where("listingId")
        .equals(zonesListing?.id)
        .first();
      tree = item?.zonesTree ?? [];
    }
    setLoading(false);
    return tree;
  }, [zonesListing?.id, zonesUpdatedAt]);

  return {value: zonesTree, loading};
}
