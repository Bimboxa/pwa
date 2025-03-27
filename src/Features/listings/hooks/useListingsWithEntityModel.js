import {useState, useEffect} from "react";
import getEntityModelAsync from "App/services/getEntityModel";

export default function useListingsEntityModels(listings) {
  // state

  const [newListings, setNewListings] = useState(listings);

  // init

  const getModels = async (listings) => {
    const listingsWithModel = await Promise.all(
      listings.map((listing) => {
        getEntityModelAsync(listing?.entityModelKey);
      })
    );
    setNewListings(listingsWithModel);
  };

  const hash = listings
    .map((listing) => listing?.id)
    .sort()
    .join(",");

  useEffect(() => {
    getModels;
  }, [hash]);

  // return

  return newListings;
}
