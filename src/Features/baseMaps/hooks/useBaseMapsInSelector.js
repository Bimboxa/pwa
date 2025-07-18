import { useSelector } from "react-redux";
import useEntities from "Features/entities/hooks/useEntities";

export default function useBaseMapsInSelector() {
  // data

  const baseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );

  // helpers

  const listingsIds = [baseMapsListingId];

  // data

  const { value: entities, loading: loadingEntities } = useEntities({
    filterByListingsIds: listingsIds,
    withImages: true,
  });

  const baseMaps = entities?.map((entity) => {
    return {
      ...entity,
      imageUrl: entity?.image?.imageUrlClient,
      imageWidth: entity?.image?.imageSize.width,
      imageHeight: entity?.image?.imageSize.height,
      meterByPx: entity?.image?.meterByPx ?? 0.01,
    };
  });

  return {
    value: baseMaps,
    //loading: loadingListings || loadingEntities,
    loading: loadingEntities,
  };
}
