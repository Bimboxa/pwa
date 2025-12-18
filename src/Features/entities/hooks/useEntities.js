import { useState } from "react";
import { useSelector } from "react-redux";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getSortedItems from "Features/misc/utils/getSortedItems";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import { setFilterByMainBaseMap } from "Features/mapEditor/mapEditorSlice";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getEntityComputedFieldsAsync from "../services/getEntityComputedFieldsAsync";

export default function useEntities(options) {
  // options

  const wait = options?.wait;

  const withImages = options?.withImages;
  const withMarkers = options?.withMarkers;
  const withAnnotations = options?.withAnnotations;
  const withComputedFields = options?.withComputedFields;
  const withQties = options?.withQties;

  const filterByListingsKeys = options?.filterByListingsKeys;
  const filterByListingsIds = options?.filterByListingsIds;
  const filterByMainBaseMap = options?.filterByMainBaseMap;

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

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const selectedListing = listings?.find((l) => l?.id === selectedListingId);
  const entitiesUpdatedAt = useSelector((s) => s.entities.entitiesUpdatedAt);
  const annotationTemplates = useAnnotationTemplates();
  const annotations = useAnnotationsV2({ withQties });

  // helpers
  const annotationTemplatesById = getItemsByKey(annotationTemplates, "id");

  // helpers

  let listingsById = {};
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

    listingsById = getItemsByKey(allListings ?? {}, "id");

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

  let entities = useLiveQuery(async () => {
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

                  if (file && file.fileArrayBuffer) {
                    entityWithImages[key] = {
                      ...value,
                      file,
                      imageUrlClient: URL.createObjectURL(
                        new Blob([file.fileArrayBuffer], {
                          type: file.fileMime,
                        })
                      ),
                    };
                  }
                }
              })
            );
            return entityWithImages;
          })
        );
      }

      // add annotations
      // if (withAnnotations && projectId) {
      //   const annotations = await db.annotations
      //     .where("projectId")
      //     .equals(projectId)
      //     .toArray();
      //   //const annotationsByEntityId = getItemsByKey(annotations, "entityId");
      //   const annotationsByEntityId = annotations.reduce((acc, annotation) => {
      //     const annotationTemplate =
      //       annotationTemplatesById[annotation?.annotationTemplateId];
      //     const _annotation = {
      //       ...annotation,
      //       label: annotationTemplate?.label,
      //     };
      //     if (!acc[annotation.entityId]) {
      //       acc[annotation.entityId] = [_annotation];
      //     } else {
      //       acc[annotation.entityId].push(_annotation);
      //     }
      //     return acc;
      //   }, {});

      //   entities = entities.map((entity) => {
      //     const annotations = annotationsByEntityId[entity.id];
      //     return {
      //       ...entity,
      //       annotations,
      //     };
      //   });
      // }

      // add computedFields

      if (withComputedFields) {
        entities = await Promise.all(
          entities.map(async (entity) => {
            const listing = listingsById[entity.listingId];
            const _computedFields = listing?.entityModel?.computedFields;

            // const computedFields = await getEntityComputedFieldsAsync(
            //   _computedFields,
            //   entity,
            //   entities
            // );
            const computedFields = await getEntityComputedFieldsAsync(entity);
            return { ...entity, ...computedFields };
          })
        );
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
  }, [
    listingsIdsHash,
    entitiesUpdatedAt,
    baseMapId,
    withMarkers,
    filterByMainBaseMap,
  ]);

  if (withAnnotations) {
    entities = entities?.map((entity) => {
      return {
        ...entity,
        annotations: annotations?.filter((a) => a.entityId === entity.id),
      };
    });
  }

  // filter by baseMapId
  if (filterByMainBaseMap) {
    entities = entities?.filter((entity) => {
      return entity?.annotations?.map((a) => a.baseMapId).includes(baseMapId);
    });
  }

  return { value: entities, loading };
}
