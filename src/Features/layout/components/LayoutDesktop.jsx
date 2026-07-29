import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxFlexV from "./BoxFlexV";

import TopBarDesktop from "./TopBarDesktop";
import SectionViewer from "./SectionViewer";
import BottomBarDesktop from "./BottomBarDesktop";
import LeftPanel from "Features/leftPanel/components/LeftPanel";

import RightPanelContainer from "Features/rightPanel/components/RightPanelContainer";
import VerticalMenuViewers from "Features/viewers/components/VerticalMenuViewers";

import useViewerSwitchHotkeys from "Features/viewers/hooks/useViewerSwitchHotkeys";
import useToggleThreedViewerHotkey from "Features/viewers/hooks/useToggleThreedViewerHotkey";
import useRightPanelToolHotkeys from "Features/rightPanel/hooks/useRightPanelToolHotkeys";
import useInitViewerModuleOnScopeOpen from "Features/viewers/hooks/useInitViewerModuleOnScopeOpen";
import useLandingViewerModuleOnScopeOpen from "Features/viewers/hooks/useLandingViewerModuleOnScopeOpen";

export default function LayoutDesktop() {
  // hotkeys — switch module (D = Dessin, F = Fonds de plan, V = Points de vue).
  // Mounted here (not in VerticalMenuViewers) so they survive full screen,
  // where the viewers band is unmounted.
  useViewerSwitchHotkeys();
  // "T" — toggle the 2D/3D editor inside the current module. Mounted here
  // (not in ButtonToggleThreedViewer) since the button is conditional.
  useToggleThreedViewerHotkey();
  // Right-panel tool shortcuts (N = Élévation, B = Banque d'objets). Mounted at
  // layout level too, so they work in every module the tool is available in.
  useRightPanelToolHotkeys();
  // Scope-open seeding of the Viewer module's 3D visibility (images off,
  // annotations of every annotated baseMap on).
  useInitViewerModuleOnScopeOpen();
  // Scope-change landing on a module (Viewer, or Dessin for a freshly created
  // scope). Skipped on refresh / same-scope reopen, where the persisted
  // module/editor context is restored.
  useLandingViewerModuleOnScopeOpen();

  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

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
