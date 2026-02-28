import {useSelector, useDispatch} from "react-redux";

import {setSelectedEntity} from "../relsZoneEntitySlice";

import useEntities from "Features/entities/hooks/useEntities";

import {Box} from "@mui/material";

import FormGeneric from "Features/form/components/FormGeneric";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

export default function BlockListingSelectedEntity() {
  const dispatch = useDispatch();

  // data

  const {value: listing} = useSelectedListing();
  const {value: listings} = useListingsByScope();

  const selectedEntity = useSelector((s) => s.relsZoneEntity.selectedEntity);

  // data - entities

  const {value: entities} = useEntities({
    filterByListingsIds: [listing?.relatedListing?.id],
  });

  const relatedListing = listings?.find(
    (l) => l.id === listing?.relatedListing?.id
  );

  // helper - form

  const template = {
    fields: [
      {
        key: "entity",
        label: relatedListing?.entityModel?.strings?.labelEntity,
        type: "entity",
        entities,
        entityModel: relatedListing?.entityModel,
      },
    ],
  };

  // handlers

  function handleItemChange(item) {
    console.log("[BlockListingSelectedEntity] handleItemChange", item);
    dispatch(setSelectedEntity(item));
  }

  return (
    <Box sx={{flexGrow: 1}}>
      <FormGeneric
        template={template}
        item={selectedEntity}
        onItemChange={handleItemChange}
      />
    </Box>
  );
}
