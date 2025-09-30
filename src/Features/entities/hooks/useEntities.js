import { useState } from "react";
import { useSelector } from "react-redux";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getSortedItems from "Features/misc/utils/getSortedItems";

export default function useEntities(options) {
  // options

  const wait = options?.wait;

  const withImages = options?.withImages;
  const withMarkers = options?.withMarkers;
  const withAnnotations = options?.withAnnotations;

  const filterByListingsKeys = options?.filterByListingsKeys;
  const filterByListingsIds = options?.filterByListingsIds;

  const sortBy = options?.sortBy;

  // state

  const [loading, setLoading] = useState(true);

  // data

  const { value: listings, loading: loadingList } = useListingsByScope({
    withEntityModel: true,
    filterByKeys: filterByListingsKeys ?? null,
    filterByListingsIds: filterByListingsIds ?? null,
  });
  //console.log("[debug] listings", lTistings?.length, filterByListingsIds);

  //const baseMapId = useSelector((s) => s.mapEditor.loadedMainBaseMapId);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const selectedListing = listings?.find((l) => l?.id === selectedListingId);
  const entitiesUpdatedAt = useSelector((s) => s.entities.entitiesUpdatedAt);

  // helpers

  let labelKeyByListingId = {};
  let subLabelKeyByListingId = {};
  let listingKeyByListingId = {};
  let entityModelTypeByListingId = {};

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

    entityModelTypeByListingId = allListings.reduce((acc, listing) => {
      if (listing?.id) {
        acc[listing.id] = listing.entityModel?.type;
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
        const table = selectedListing?.table;
        if (table) {
          entities = await db[table]
            .where("listingId")
            .anyOf(listingsIds)
            .toArray();
        }
      } else if (listingsIds.length === 1) {
        const _listingId = listingsIds[0];
        const listing = listings.find((l) => l.id === _listingId);
        const table = listing?.table;
        if (table) {
          entities = await db[table]
            .where("listingId")
            .equals(listingsIds[0])
            .toArray();
        }
      }

      entities = entities.filter(Boolean);

      // add images
      if (withImages) {
        entities = await Promise.all(
          entities.map(async (entity) => {
            const entityWithImages = { ...entity };
            const entriesWithImages = Object.entries(entity).filter(
              ([key, value]) => value?.isImage
            );
            await Promise.all(
              entriesWithImages.map(async ([key, value]) => {
                if (value.fileName) {
                  const file = await db.files.get(value.fileName);

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
      // if (withMarkers && baseMapId) {
      //   const markers = await db.markers
      //     .where("baseMapId")
      //     .equals(baseMapId)
      //     .toArray();
      //   const markersByEntityId = getItemsByKey(markers, "targetEntityId");

      //   entities = entities.map((entity) => {
      //     const marker = markersByEntityId[entity.id];
      //     return { ...entity, marker };
      //   });
      // }

      // add annotations
      if (withAnnotations && baseMapId) {
        const annotations = await db.annotations
          .where("baseMapId")
          .equals(baseMapId)
          .toArray();
        const annotationsByEntityId = getItemsByKey(annotations, "entityId");

        entities = entities.map((entity) => {
          const annotation = annotationsByEntityId[entity.id];
          return { ...entity, annotation };
        });
      }

      // add label && listingKey
      entities = entities.map((entity) => {
        const labelKey = labelKeyByListingId[entity.listingId];
        const subLabelKey = subLabelKeyByListingId[entity.listingId];
        const label = entity[labelKey];
        const subLabel = entity[subLabelKey];
        const listingKey = listingKeyByListingId[entity.listingId];
        const entityModelType = entityModelTypeByListingId[entity.listingId];
        return { ...entity, label, subLabel, listingKey, entityModelType };
      });

      // sort
      if (sortBy?.key) {
        entities = getSortedItems(entities, sortBy);
      } else {
        entities = getSortedItems(entities, "label");
      }
      // end
      setLoading(false);
      return entities;
    } catch (e) {
      console.log("[db] error fetching entities", e);
      setLoading(false);
      return [];
    }
  }, [listingsIdsHash, entitiesUpdatedAt, baseMapId, withMarkers]);

  return { value, loading };
}
