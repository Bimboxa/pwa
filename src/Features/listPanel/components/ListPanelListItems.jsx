import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useAutoSelectListing from "Features/listings/hooks/useAutoSelectListing";

import {Box} from "@mui/material";

import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionTreeZonesInListPanel from "Features/zones/components/SectionTreeZonesInListPanel";
import SectionListEntityPropsInListPanel from "Features/entityProps/components/SectionListEntityPropsInListPanel";
import SectionDataObjectInListPanel from "Features/dataObjects/components/SectionDataObjectInListPanel";

export default function ListPanelListItems() {
  // data
  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  // effect

  useAutoSelectListing();

  // helpers

  const componentByType = {
    ZONE_ENTITY_MODEL: <SectionTreeZonesInListPanel />,
    ENTITY_PROPS: <SectionListEntityPropsInListPanel />,
    KEY_VALUE: <SectionDataObjectInListPanel />,
  };

  const component = componentByType[entityModel?.type] ?? (
    <SectionListEntitiesInListPanel />
  );

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
      {component}
    </Box>
  );
}
