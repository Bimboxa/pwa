import {useState} from "react";
import {useSelector} from "react-redux";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useEntities from "Features/entities/hooks/useEntities";
import {useLiveQuery} from "dexie-react-hooks";

import db from "App/db/db";

export default function useMaps() {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const {value: listings, loading: loadingListings} = useListingsByScope({
    mapsOnly: true,
    withEntityModel: true,
  });

  // helpers

  const listingsIds = listings?.map((l) => l.id);

  // data

  // const {value: entities, loading: loadingEntities} = useEntities({
  //   wait: loadingListings,
  //   filterByListingsIds: listingsIds,
  //   withImages: true,
  // });

  const entities = useLiveQuery(async () => {
    const entities = await db.maps
      .where("listingId")
      .anyOf(listingsIds)
      .toArray();

    return entities;
  }, [scopeId]);

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
    //loading: loadingListings || loadingEntities,
    loading: loadingListings,
  };
}
