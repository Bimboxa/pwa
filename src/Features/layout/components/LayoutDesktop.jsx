import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";

import {
  setModuleEditorKey,
  setSelectedViewerKey,
} from "Features/viewers/viewersSlice";

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

export default function LayoutDesktop() {
  const dispatch = useDispatch();

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

  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  // A freshly created scope lands on the Dessin module (2D editor) — the
  // Viewer landing is for reopening scopes that already have content.
  const landOnDrawScopeId = useSelector((s) => s.viewers.landOnDrawScopeId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const isNewScopeDrawLanding =
    Boolean(landOnDrawScopeId) && landOnDrawScopeId === selectedScopeId;

  // honor ?viewer=3d deep link: don't reset the viewer to MAP when 3D is requested
  const [searchParams] = useSearchParams();
  const wants3dViewer = searchParams.get("viewer") === "3d";

  // effects

  useEffect(() => {
    if (disable3D) {
      dispatch(setSelectedViewerKey("MAP"));
    } else if (!advancedLayout && !wants3dViewer) {
      if (isNewScopeDrawLanding) {
        // Freshly created scope: straight to drawing.
        dispatch(setSelectedViewerKey("MAP"));
        dispatch(setModuleEditorKey({ moduleKey: "MAP", editorKey: "MAP" }));
      } else {
        // Default landing module: the Viewer (read-only overview), always on
        // its 3D editor even if the module was left on 2D earlier in the
        // session.
        dispatch(setSelectedViewerKey("THREED"));
        dispatch(
          setModuleEditorKey({ moduleKey: "THREED", editorKey: "THREED" })
        );
      }
    }
  }, [
    advancedLayout,
    wants3dViewer,
    disable3D,
    isNewScopeDrawLanding,
    dispatch,
  ]);

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
