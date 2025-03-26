import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/entities/hooks/useListingEntityModel";
import useZonesTree from "Features/zones/hooks/useZonesTree";

import getEntityModelTemplate from "Features/form/utils/getEntityModelTemplate";

export default function useEntityFormTemplate() {
  // data

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);
  const {value: zonesTree} = useZonesTree();

  const template = getEntityModelTemplate(entityModel, {zonesTree});

  return template;
}
