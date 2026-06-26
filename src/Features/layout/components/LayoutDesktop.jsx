import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

import useLeftAreaHover from "Features/leftPanel/hooks/useLeftAreaHover";

import { Box } from "@mui/material";

import BoxFlexV from "./BoxFlexV";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import BottomBarDesktop from "./BottomBarDesktop";
import LeftPanel from "Features/leftPanel/components/LeftPanel";

import RightPanelContainer from "Features/rightPanel/components/RightPanelContainer";
import VerticalMenuViewers from "Features/viewers/components/VerticalMenuViewers";

function LeftEdgeHoverZone() {
  const { onMouseEnter, onMouseLeave } = useLeftAreaHover();

  return (
    <Box
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 12,
        zIndex: 5,
      }}
    />
  );
}

export default function LayoutDesktop() {
  const dispatch = useDispatch();

  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  // honor ?viewer=3d deep link: don't reset the viewer to MAP when 3D is requested
  const [searchParams] = useSearchParams();
  const wants3dViewer = searchParams.get("viewer") === "3d";

  // effects

  useEffect(() => {
    if (!advancedLayout && !wants3dViewer) {
      dispatch(setSelectedViewerKey("MAP"));
    }
  }, [advancedLayout, wants3dViewer, dispatch]);

  return (
    <BoxFlexV sx={{ position: "relative" }}>
      {!isFullScreen && <TopBarDesktop />}
      <Box sx={{ display: "flex", width: 1, flexGrow: 1, minHeight: 0, position: "relative" }}>
        {!isFullScreen && <VerticalMenuViewers />}
        {!isFullScreen && !leftPanelDocked && <LeftEdgeHoverZone />}
        <Box sx={{ display: "flex", width: 1, minWidth: 0, minHeight: 0 }}>
          <LeftPanel />
          <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
            <SectionViewer />
          </Box>
          <RightPanelContainer />
        </Box>
      </Box>
      <BottomBarDesktop />
    </BoxFlexV>
  );
}
