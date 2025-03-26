import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";

import {Box} from "@mui/material";

import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionTreeZonesInListPanel from "Features/zones/components/SectionTreeZonesInListPanel";

export default function ListPanelListItems() {
  // data
  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  // helpers
  const isZones = entityModel?.type === "LOCATION_ENTITY_MODEL";

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "auto",
      }}
    >
      {!isZones && <SectionListEntitiesInListPanel />}
      {isZones && <SectionTreeZonesInListPanel />}
    </Box>
  );
}
