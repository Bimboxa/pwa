import { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setLeftDrawerHovered } from "Features/leftPanel/leftPanelSlice";
import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

import { Box } from "@mui/material";

import BoxFlexV from "./BoxFlexV";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import BottomBarDesktop from "./BottomBarDesktop";
import LeftPanel from "Features/leftPanel/components/LeftPanel";

import RightPanelContainer from "Features/rightPanel/components/RightPanelContainer";
import VerticalMenuViewers from "Features/viewers/components/VerticalMenuViewers";

function LeftEdgeHoverZone() {
  const dispatch = useDispatch();
  const leaveTimeoutRef = useRef(null);

  function handleMouseEnter() {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    dispatch(setLeftDrawerHovered(true));
  }

  function handleMouseLeave() {
    leaveTimeoutRef.current = setTimeout(() => {
      dispatch(setLeftDrawerHovered(false));
    }, 300);
  }

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

  // effects

  useEffect(() => {
    if (!advancedLayout) {
      dispatch(setSelectedViewerKey("MAP"));
    }
  }, [advancedLayout, dispatch]);

  // helpers

  const showVerticalMenu = advancedLayout && !isFullScreen;

  return (
    <BoxFlexV sx={{ position: "relative" }}>
      {!isFullScreen && <TopBarDesktop />}
      <Box sx={{ display: "flex", width: 1, flexGrow: 1, minHeight: 0 }}>
        {showVerticalMenu && <VerticalMenuViewers />}
        {!showVerticalMenu && !isFullScreen && <LeftEdgeHoverZone />}
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
