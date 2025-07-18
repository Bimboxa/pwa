import { useSelector } from "react-redux";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useEntities from "Features/entities/hooks/useEntities";

export default function useBaseMaps(options) {
  // options

  const filterByListingId = options?.filterByListingId;

  // data

  const { value: listings } = useListingsByScope({
    baseMapsOnly: true,
    withEntityModel: true,
  });

  // helpers

  let listingsIds = listings?.map((l) => l.id);
  if (filterByListingId) listingsIds = [filterByListingId];

  // data

  const { value: entities } = useEntities({
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
  };
}
