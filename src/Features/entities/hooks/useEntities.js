import {useState} from "react";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "./useListingEntityModel";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

export default function useEntities(options) {
  // options

  const withImages = options?.withImages;
  const filterByListingsKeys = options?.filterByListingsKeys;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const {value: selectedListing, loading: loadingSelection} =
    useSelectedListing({withEntityModel: true});

  const {value: listings, loading: loadingList} = useListingsByScope({
    withEntityModel: true,
    filterByKeys: filterByListingsKeys ?? [],
  });

  // helpers

  let labelKeyByListingId = {};
  let listingKeyByListingId = {};

  if (!loadingSelection && !loadingList) {
    const allListings = [...(listings ?? []), selectedListing];
    labelKeyByListingId = allListings.reduce((acc, listing) => {
      if (listing?.id) {
        acc[listing.id] = listing.entityModel?.labelKey;
      }

      return acc;
    }, {});
    listingKeyByListingId = allListings.reduce((acc, listing) => {
      if (listing?.id) {
        acc[listing.id] = listing.key;
      }

      return acc;
    }, {});
  }
  // helpers

  const listingsIds = filterByListingsKeys
    ? listings?.map((l) => l.id)
    : selectedListing?.id
    ? [selectedListing?.id]
    : [];

  const listingsIdsHash = listingsIds?.sort().join(",");

  const value = useLiveQuery(async () => {
    try {
      // edge case
      if (listingsIds.length === 0) {
        setLoading(false);
        return [];
      }
      // fetch entities

      let entities = [];
      if (listingsIds.length > 1) {
        entities = await db.entities
          .where("listingId")
          .anyOf(listingsIds)
          .toArray();
      } else if (listingsIds.length === 1) {
        entities = await db.entities
          .where("listingId")
          .equals(listingsIds[0])
          .toArray();
      }

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

      // add label && listingKey
      entities = entities.map((entity) => {
        const labelKey = labelKeyByListingId[entity.listingId];
        const label = entity[labelKey];
        const listingKey = listingKeyByListingId[entity.listingId];
        return {...entity, label, listingKey};
      });
      // end
      setLoading(false);
      return entities;
    } catch (e) {
      console.log("[db] error fetching entities", e);
      setLoading(false);
      return [];
    }
  }, [listingsIdsHash]);

  return {value, loading};
}
