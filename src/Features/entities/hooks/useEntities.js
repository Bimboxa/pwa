import {useState} from "react";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "./useListingEntityModel";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

export default function useEntities(options) {
  // options

  const withImages = options?.withImages;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const {value: selectedListing} = useSelectedListing();
  const entityModel = useListingEntityModel(selectedListing);

  // helpers

  const labelKey = entityModel?.labelKey;

  // helpers

  const listingId = selectedListing?.id;

  const value = useLiveQuery(async () => {
    try {
      // edge case
      if (!listingId) {
        setLoading(false);
        return [];
      }
      // fetch entities

      let entities = await db.entities
        .where("listingId")
        .equals(listingId)
        .toArray();

      entities = entities.filter(Boolean);

      // add images
      if (withImages) {
        entities = await Promise.all(
          entities.map(async (entity) => {
            const entityWithImages = {...entity};
            const entriesWithImages = Object.entries(entity).filter(
              ([key, value]) => value?.isImage
            );
            await Promise.all(
              entriesWithImages.map(async ([key, value]) => {
                const file = await db.files.get(value.fileId);
                entityWithImages[key] = {
                  ...value,
                  file,
                  imageUrlClient: URL.createObjectURL(file.file),
                };
              })
            );
            return entityWithImages;
          })
        );
      }

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
