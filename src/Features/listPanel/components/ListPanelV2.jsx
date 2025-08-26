import { useSelector } from "react-redux";

import { Paper } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionBaseMapViewsInListPanel from "Features/baseMapViews/components/SectionBaseMapViewsInListPanel";
import SectionBaseMapsInListPanel from "Features/baseMaps/components/SectionBaseMapsInListPanel";
import SectionLocatedEntitiesInListPanel from "Features/locatedEntities/components/SectionLocatedEntitiesInListPanel";

export default function ListPanelV2() {
  // data

  const key = useSelector((s) => s.listPanel.selectedListTypeKey);

  return (
    <Paper
      //elevation={12}
      square
      sx={{
        width: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 1,
      }}
    >
      {key === "BASE_MAP_VIEWS" && <SectionBaseMapViewsInListPanel />}
      {key === "BASE_MAPS" && <SectionBaseMapsInListPanel />}
      {key === "LOCATED_ENTITIES" && <SectionLocatedEntitiesInListPanel />}
    </Paper>
  );
}
