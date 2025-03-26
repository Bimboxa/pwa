import {useState, useEffect} from "react";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import getEntityModelAsync from "App/services/getEntityModel";

export default function useZonesTree() {
  const [loading, setLoading] = useState(true);

  const [zonesListing, setZonesListing] = useState(null);

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
    let tree = [];
    if (zonesListing?.id) {
      setLoading(true);
      const item = await db.entities
        .where("listingId")
        .equals(zonesListing?.id)
        .first();
      tree = item?.zonesTree ?? [];
      console.log("item", item);
    }
    setLoading(false);
    return tree;
  }, [zonesListing?.id]);

  return {value: zonesTree, loading};
}
