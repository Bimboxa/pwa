import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useZonesTree from "Features/zones/hooks/useZonesTree";
import useEntities from "./useEntities";
import useNomenclaturesByKey from "Features/nomenclatures/hooks/useNomenclaturesByKey";

import getEntityModelTemplate from "Features/form/utils/getEntityModelTemplate";
import getListingRelatedEntitiesListingsIds from "Features/listings/utils/getListingRelatedEntitiesListingsIds";
import getListingEntityModelTemplate from "Features/form/utils/getListingEntityModelTemplate";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

export default function useEntityFormTemplate() {
  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const {value: listings} = useListingsByScope();

  const template = getListingEntityModelTemplate({listing, listings});

  return template;
}
