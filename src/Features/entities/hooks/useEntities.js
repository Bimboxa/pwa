import {useState} from "react";
import {useSelector} from "react-redux";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useEntities(options) {
  // options

  const wait = options?.wait;

  const withImages = options?.withImages;
  const withMarkers = options?.withMarkers;

  const filterByListingsKeys = options?.filterByListingsKeys;
  const filterByListingsIds = options?.filterByListingsIds;

  const sortBy = options?.sortBy;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const {value: listings, loading: loadingList} = useListingsByScope({
    withEntityModel: true,
    filterByKeys: filterByListingsKeys ?? null,
    filterByListingsIds: filterByListingsIds ?? null,
  });
  //console.log("[debug] listings", listings?.length, filterByListingsIds);

  const mapId = useSelector((s) => s.mapEditor.loadedMainMapId);

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const selectedListing = listings?.find((l) => l?.id === selectedListingId);
  const entitiesUpdatedAt = useSelector((s) => s.entities.entitiesUpdatedAt);

  // helpers

  let labelKeyByListingId = {};
  let subLabelKeyByListingId = {};
  let listingKeyByListingId = {};

  if (!loadingList) {
    const allListings = [...(listings ?? []), selectedListing];
    subLabelKeyByListingId = allListings.reduce((acc, listing) => {
      if (listing?.id) {
        acc[listing.id] = listing.entityModel?.subLabelKey;
      }

      return acc;
    }, {});
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
  const useListingsFilters =
    filterByListingsKeys?.length > 0 || filterByListingsIds?.length > 0;

  const listingsIds = useListingsFilters
    ? listings?.map((l) => l.id)
    : selectedListing?.id
    ? [selectedListing?.id]
    : [];

  //console.log("[debug] listingsIds", listingsIds);

  const listingsIdsHash = listingsIds?.sort().join(",");

  const value = useLiveQuery(async () => {
    try {
      // edge case
      if (listingsIds.length === 0 || wait) {
        setLoading(false);
        return [];
      }
      // fetch entities
      console.log("[db] fetching entities", listingsIds);
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
                if (value.fileName) {
                  const file = await db.files.get(value.fileName);
                  console.log("debug_2804_2 file from files db", file);
                  if (file && file.file) {
                    entityWithImages[key] = {
                      ...value,
                      file,
                      imageUrlClient: URL.createObjectURL(file.file),
                    };
                  }
                }
              })
            );
            return entityWithImages;
          })
        );
      }

      // add markers
      if (withMarkers && mapId) {
        const markers = await db.markers.where("mapId").equals(mapId).toArray();
        const markersByEntityId = getItemsByKey(markers, "targetEntityId");

        entities = entities.map((entity) => {
          const marker = markersByEntityId[entity.id];
          return {...entity, marker};
        });
      }

      // sort
      if (sortBy?.key) {
        entities = entities.sort((a, b) => {
          if (sortBy?.order === "desc") {
            return b[sortBy.key] - a[sortBy.key];
          } else {
            return a[sortBy.key] - b[sortBy.key];
          }
        });
      }

      // add label && listingKey
      entities = entities.map((entity) => {
        const labelKey = labelKeyByListingId[entity.listingId];
        const subLabelKey = subLabelKeyByListingId[entity.listingId];
        const label = entity[labelKey];
        const subLabel = entity[subLabelKey];
        const listingKey = listingKeyByListingId[entity.listingId];
        return {...entity, label, subLabel, listingKey};
      });
      // end
      setLoading(false);
      return entities;
    } catch (e) {
      console.log("[db] error fetching entities", e);
      setLoading(false);
      return [];
    }
  }, [listingsIdsHash, entitiesUpdatedAt, mapId, withMarkers]);

  return {value, loading};
}
