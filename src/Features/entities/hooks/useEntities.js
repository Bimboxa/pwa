import {useState} from "react";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "./useListingEntityModel";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

export default function useEntities() {
  // state

  const [loading, setLoading] = useState(true);

  // data

  const selectedListing = useSelectedListing();
  const entityModel = useListingEntityModel(selectedListing);

  // helpers

  const labelKey = entityModel?.labelKey;

  // helpers

  const listingId = selectedListing?.id;

  const value = useLiveQuery(async () => {
    try {
      let entities = await db.entities
        .where("listingId")
        .equals(listingId)
        .toArray();

      // add label
      entities = entities.map((entity) => {
        const label = entity[labelKey];
        return {...entity, label};
      });
      // end
      setLoading(false);
      return entities;
    } catch (e) {
      console.log("[db] error fetching entities", e);
      setLoading(false);
      return [];
    }
  }, [listingId, labelKey]);

  return {value, loading};
}
