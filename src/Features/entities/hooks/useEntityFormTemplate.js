import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/entities/hooks/useListingEntityModel";

import getEntityModelTemplate from "Features/form/utils/getEntityModelTemplate";

export default function useEntityFormTemplate() {
  // data

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  const template = getEntityModelTemplate(entityModel);

  return template;
}
