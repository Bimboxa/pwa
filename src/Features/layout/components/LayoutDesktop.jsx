import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

import { Box } from "@mui/material";

import BoxFlexV from "./BoxFlexV";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import BottomBarDesktop from "./BottomBarDesktop";
import LeftPanel from "Features/leftPanel/components/LeftPanel";

import RightPanelContainer from "Features/rightPanel/components/RightPanelContainer";
import VerticalMenuViewers from "Features/viewers/components/VerticalMenuViewers";

import useViewerSwitchHotkeys from "Features/viewers/hooks/useViewerSwitchHotkeys";

export default function LayoutDesktop() {
  const dispatch = useDispatch();

  // hotkeys — switch viewer (D = Dessin, F = Fonds de plan, V = Points de vue).
  // Mounted here (not in VerticalMenuViewers) so they survive full screen,
  // where the viewers band is unmounted.
  useViewerSwitchHotkeys();

  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const disable3D = useSelector((s) => s.appConfig.disable3D);

  // honor ?viewer=3d deep link: don't reset the viewer to MAP when 3D is requested
  const [searchParams] = useSearchParams();
  const wants3dViewer = searchParams.get("viewer") === "3d";

  // effects

  useEffect(() => {
    if ((!advancedLayout && !wants3dViewer) || disable3D) {
      dispatch(setSelectedViewerKey("MAP"));
    }
  }, [advancedLayout, wants3dViewer, disable3D, dispatch]);

  return (
    <BoxFlexV sx={{ position: "relative" }}>
      {!isFullScreen && <TopBarDesktop />}
      <Box sx={{ display: "flex", width: 1, flexGrow: 1, minHeight: 0, position: "relative" }}>
        {!isFullScreen && <VerticalMenuViewers />}
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
