import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxFlexV from "./BoxFlexV";
import BoxFlexVStretch from "./BoxFlexVStretch";
import BoxFlexHStretch from "./BoxFlexHStretch";

import LayerDesktop from "./LayerDesktop";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import ListPanel from "Features/listPanel/components/ListPanel";
import PanelChatContainer from "./PanelChatContainer";

import PanelListItem from "Features/listPanel/components/PanelListItem";
import PanelLegend from "Features/legend/components/PanelLegend";
import BottomBarDesktop from "./BottomBarDesktop";

export default function LayoutDesktop() {
  // data

  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);
  const listPanelWidth = useSelector((s) => s.listPanel.width);
  const top = useSelector((s) => s.layout.topBarHeight);

  // helpers

  const transform = openPanelListItem
    ? "translateX(0px)"
    : `translateX(-${listPanelWidth}px)`;

  return (
    <BoxFlexV sx={{ position: "relative" }}>
      <LayerDesktop />
      {/*<TopBarDesktop />*/}
      <BoxFlexHStretch>
        {/*<ListPanel />*/}
        <SectionViewer />
      </BoxFlexHStretch>
      <BottomBarDesktop />
      <PanelChatContainer />

      <Box
        sx={{
          position: "absolute",

          top,
          bottom: 0,
          left: 0,
          width: listPanelWidth,
          transform,
          zIndex: 100,
          boxSizing: "border-box",
          bgcolor: "background.default",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PanelListItem />
      </Box>
    </BoxFlexV>
  );
}
