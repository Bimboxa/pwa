import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";
import useAutoSelectListing from "Features/listings/hooks/useAutoSelectListing";

import {Box} from "@mui/material";

import SectionListEntitiesInListPanel from "Features/entities/components/SectionListEntitiesInListPanel";
import SectionTreeZonesInListPanel from "Features/zones/components/SectionTreeZonesInListPanel";
import SectionListEntityPropsInListPanel from "Features/entityProps/components/SectionListEntityPropsInListPanel";
import SectionDataObjectInListPanel from "Features/dataObjects/components/SectionDataObjectInListPanel";
import SectionNomenclatureInListPanel from "Features/nomenclatures/components/SectionNomenclatureInListPanel";
import SectionReportsInListPanel from "Features/reports/components/SectionReportsInListPanel";
import SectionRelsZoneEntityInListPanel from "Features/relsZoneEntity/components/SectionRelsZoneEntityInListPanel";

export default function ListPanelListItems() {
  // data
  const {value: listing} = useSelectedListing({withEntityModel: true});
  const entityModel = listing?.entityModel;

  // effect

  useAutoSelectListing();

  // helpers

  const componentByType = {
    ZONE_ENTITY_MODEL: <SectionTreeZonesInListPanel />,
    REL_ZONE_ENTITY: <SectionRelsZoneEntityInListPanel />,
    ENTITY_PROPS: <SectionListEntityPropsInListPanel />,
    KEY_VALUE: <SectionDataObjectInListPanel />,
    NOMENCLATURE_ITEM: <SectionNomenclatureInListPanel />,
    REPORT: <SectionReportsInListPanel />,
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
