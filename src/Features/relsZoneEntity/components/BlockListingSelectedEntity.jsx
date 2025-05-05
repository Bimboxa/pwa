import {useSelector, useDispatch} from "react-redux";

import {setSelectedEntity} from "../relsZoneEntitySlice";

import useEntities from "Features/entities/hooks/useEntities";

import {Box} from "@mui/material";

import FormGeneric from "Features/form/components/FormGeneric";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function BlockListingSelectedEntity() {
  const dispatch = useDispatch();

  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const selectedEntity = useSelector((s) => s.relsZoneEntity.selectedEntity);

  // data - entities

  const {value: entities} = useEntities({
    filterByListingsIds: [listing?.relatedListing?.id],
  });

  console.log("[BlockListingSelectedEntity] entities", entities, listing);

  // helper - form

  const template = {
    fields: [{key: "entity", label: "Entity", type: "entity", entities}],
  };

  // handlers

  function handleItemChange(item) {
    console.log("[BlockListingSelectedEntity] handleItemChange", item);
    dispatch(setSelectedEntity(item));
  }

  return (
    <Box>
      <FormGeneric
        template={template}
        item={selectedEntity}
        onItemChange={handleItemChange}
      />
    </Box>
  );
}
