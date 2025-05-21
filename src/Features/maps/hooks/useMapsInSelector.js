import {useSelector} from "react-redux";
import useEntities from "Features/entities/hooks/useEntities";

export default function useMapsInSelector() {
  // data

  const mapsListingId = useSelector((s) => s.mapEditor.selectedMapsListingId);

  // helpers

  const listingsIds = [mapsListingId];

  // data

  const {value: entities, loading: loadingEntities} = useEntities({
    filterByListingsIds: listingsIds,
    withImages: true,
  });

  // const entities = useLiveQuery(async () => {
  //   const entities = await db.maps
  //     .where("listingId")
  //     .anyOf(listingsIds)
  //     .toArray();

  //   return entities;
  // }, [scopeId]);

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
    loading: loadingEntities,
  };
}
