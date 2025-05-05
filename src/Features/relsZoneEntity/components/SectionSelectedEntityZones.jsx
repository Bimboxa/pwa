import {useSelector, useDispatch} from "react-redux";

import {setSelectedEntity} from "../relsZoneEntitySlice";

import useEntities from "Features/entities/hooks/useEntities";

import {Box, Paper} from "@mui/material";

import FormGeneric from "Features/form/components/FormGeneric";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useZonesTree from "Features/zones/hooks/useZonesTree";

export default function SectionSelectedEntityZones() {
  const dispatch = useDispatch();

  // data

  const {value: zonesTree} = useZonesTree();
  const {value: listing} = useSelectedListing({withEntityModel: true});
  const {value: listings} = useListingsByScope({withEntityModel: true});

  const selectedEntity = useSelector((s) => s.relsZoneEntity.selectedEntity);

  // data - entities

  const {value: entities} = useEntities({
    filterByListingsIds: [listing?.relatedListing?.id],
  });

  const relatedListing = listings?.find(
    (l) => l.id === listing?.relatedListing?.id
  );

  // helper - form

  console.log("[SectionSelectedEntityZones] zonesTree", zonesTree);

  const template = {
    fields: [
      {
        key: "zones",
        label: "Zones",
        type: "treeItems",
        tree: zonesTree,
      },
    ],
  };

  // handlers

  function handleItemChange(item) {
    console.log("[BlockListingSelectedEntity] handleItemChange", item);
    dispatch(setSelectedEntity(item));
  }

  return (
    <Box sx={{flexGrow: 1, p: 2}}>
      <Paper elevation={0}>
        <FormGeneric
          template={template}
          item={selectedEntity}
          onItemChange={handleItemChange}
        />
      </Paper>
    </Box>
  );
}
