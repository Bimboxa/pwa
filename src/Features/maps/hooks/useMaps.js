import {useState} from "react";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useEntities from "Features/entities/hooks/useEntities";

export default function useMaps() {
  // data

  const {value: listings, loading: loadingListings} = useListingsByScope({
    mapsOnly: true,
    withEntityModel: true,
  });

  // helpers

  const listingsIds = listings?.map((l) => l.id);

  // data

  const {value: entities, loading: loadingEntities} = useEntities({
    wait: loadingListings,
    filterByListingsIds: listingsIds,
    withImages: true,
  });

  const maps = entities?.map((entity) => {
    return {
      ...entity,
      imageUrl: entity?.image?.imageUrlClient,
      imageWidth: entity?.image?.imageSize.width,
      imageHeight: entity?.image?.imageSize.height,
      meterByPx: entity?.image?.meterByPx ?? 0.01,
    };
  });

  return {
    value: maps,
    loading: loadingListings || loadingEntities,
  };
}
