import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import SectionShapesInListPanel from "Features/shapes/components/SectionShapesInListPanel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import MainListPanelHeader from "./MainListPanelHeader";

export default function MainListPanel() {
  // data

  const width = useSelector((s) => s.listPanel.width);
  const open = useSelector((s) => s.listPanel.open);

  // helper

  const computedWidth = open ? width : 0;

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
      <MainListPanelHeader open={open} />
      <BoxFlexVStretch>
        <SectionShapesInListPanel />
      </BoxFlexVStretch>
    </Box>
  );
}
