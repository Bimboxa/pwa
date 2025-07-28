import { useSelector } from "react-redux";

import { Paper } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionBaseMapsInListPanel from "Features/baseMaps/components/SectionBaseMapsInListPanel";
import SectionLocatedEntitiesInListPanel from "Features/locatedEntities/components/SectionLocatedEntitiesInListPanel";

export default function ListPanelV2() {
  // data

  const key = useSelector((s) => s.listPanel.selectedListTypeKey);
  console.log("listType", key);

  return (
    <Paper
      elevation={12}
      sx={{
        width: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 1,
        flexGrow: 1,
      }}
    >
      {key === "BASE_MAPS" && <SectionBaseMapsInListPanel />}
      {key === "LOCATED_ENTITIES" && <SectionLocatedEntitiesInListPanel />}
    </Paper>
  );
}
