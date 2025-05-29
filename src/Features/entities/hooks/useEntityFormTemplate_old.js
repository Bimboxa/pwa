import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useZonesTree from "Features/zones/hooks/useZonesTree";
import useEntities from "./useEntities";
import useNomenclaturesByKey from "Features/nomenclatures/hooks/useNomenclaturesByKey";

import getEntityModelTemplate from "Features/form/utils/getEntityModelTemplate";
import getListingRelatedEntitiesListingsIds from "Features/listings/utils/getListingRelatedEntitiesListingsIds";

export default function useEntityFormTemplate() {
  // data

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);
  const _nomenclaturesByKey = useNomenclaturesByKey();

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

  // helpers - nomenclaturesByKey

  const nomenclaturesByKey = {};

  Object.entries(listing?.relatedNomenclatures ?? {}).forEach(
    ([key, targetKey]) => {
      const nomenclature = _nomenclaturesByKey?.[targetKey];
      if (nomenclature) nomenclaturesByKey[key] = nomenclature;
    }
  );

  // helpers - template

  const template = getEntityModelTemplate(entityModel, {
    zonesTree,
    entitiesByRelationKey,
    nomenclaturesByKey,
  });

  return template;
}
