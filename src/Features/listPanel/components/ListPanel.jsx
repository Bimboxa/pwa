import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import SectionShapesInListPanel from "Features/shapes/components/SectionShapesInListPanel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListPanelHeader from "./ListPanelHeader";
import ListPanelBottom from "./ListPanelBottom";

export default function ListPanel() {
  // data

  const width = useSelector((s) => s.listPanel.width);
  const open = useSelector((s) => s.listPanel.open);
  const deviceType = useSelector((s) => s.layout.deviceType);

  // helper

  let computedWidth = open ? width : 0;
  if (deviceType === "MOBILE") computedWidth = 1;

  return (
    <Box
      sx={{
        width: computedWidth,
        height: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.main",
      }}
    >
      <ListPanelHeader open={open} />
      <BoxFlexVStretch>
        <SectionShapesInListPanel />
      </BoxFlexVStretch>
      <ListPanelBottom />
    </Box>
  );
}
