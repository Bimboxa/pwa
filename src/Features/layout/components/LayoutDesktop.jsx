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
import ListPanelsContainer from "Features/listPanel/components/ListPanelsContainer";
import MenuListTypes from "Features/listPanel/components/MenuListTypes";
import ListPanelV2 from "Features/listPanel/components/ListPanelV2";
import VerticalMenuRightPanel from "Features/rightPanel/components/VerticalMenuRightPanel";

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
      {/* <LayerDesktop /> */}
      <TopBarDesktop />
      <Box sx={{ display: "flex", width: 1, flexGrow: 1 }}>
        <Box sx={{ display: "flex", flexGrow: 1, minWidth: 0 }}>
          <MenuListTypes />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SectionViewer />
          </Box>

          {/*  */}
        </Box>
        <VerticalMenuRightPanel />
      </Box>
      <BottomBarDesktop />
      {/* <PanelChatContainer /> */}

      {/* <Box
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
      </Box> */}
    </BoxFlexV>
  );
}
