import {useDispatch} from "react-redux";

import {
  setEditedLocatedEntity,
  setIsEditingLocatedEntity,
  setNewLocatedEntity,
} from "../locatedEntitiesSlice";

import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useLocatedEntity from "../hooks/useLocatedEntity";

import {Box} from "@mui/material";
import getEntityModelTemplate from "Features/form/utils/getEntityModelTemplate";
import FormVariantMobile from "Features/form/components/FormVariantMobile";

export default function FormLocatedEntity() {
  const dispatch = useDispatch();

  const locatedEntity = useLocatedEntity({withListing: true});
  const entityModel = useListingEntityModel(locatedEntity?.listing);

  // helpers

  const template = getEntityModelTemplate(entityModel);

  // handlers

  function handleChange(updatedEntity) {
    console.log("[FormLocatedEntity] updatedEntity", updatedEntity);
    if (updatedEntity?.id) {
      dispatch(setEditedLocatedEntity(updatedEntity));
      dispatch(setIsEditingLocatedEntity(true));
    } else {
      dispatch(setNewLocatedEntity(updatedEntity));
    }
  }

  return (
    <Box sx={{width: 1, height: 1}}>
      <FormVariantMobile
        template={template}
        item={locatedEntity}
        onItemChange={handleChange}
      />
    </Box>
  );
}
