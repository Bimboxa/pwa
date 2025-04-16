import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useZonesTree from "Features/zones/hooks/useZonesTree";
import useEntities from "./useEntities";

import getEntityModelTemplate from "Features/form/utils/getEntityModelTemplate";
import getListingRelatedEntitiesListingsIds from "Features/listings/utils/getListingRelatedEntitiesListingsIds";

export default function useEntityFormTemplate() {
  // data

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  // helpers - listing relationKeys

  const relatedListingsIds = getListingRelatedEntitiesListingsIds(listing);

  // data - related entities

  const {value: zonesTree} = useZonesTree();
  const {value: relEntities} = useEntities({
    filterByListingsIds: relatedListingsIds,
  });

  // helpers - entitiesByRelationKey

  const entitiesByRelationKey = {};

  Object.entries(listing?.relatedEntities ?? {}).forEach(([key, value]) => {
    const {listingsIds} = value;
    const entities = relEntities?.filter((entity) => {
      return listingsIds.includes(entity.listingId);
    });
    entitiesByRelationKey[key] = entities;
  });

  // helpers - template

  const template = getEntityModelTemplate(entityModel, {
    zonesTree,
    entitiesByRelationKey,
  });

  return template;
}
