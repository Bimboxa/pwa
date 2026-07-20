import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { setSoloZone, setSelectedZoneId } from "../zoningsSlice";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";

import ZoningsTree from "./ZoningsTree";

export default function MainZonesViewer() {
  const dispatch = useDispatch();

  // helpers

  const treeWidth = 300;

  // effects — leaving the module clears the zone solo & selection

  useEffect(() => {
    return () => {
      dispatch(setSoloZone(null));
      dispatch(setSelectedZoneId(null));
    };
  }, [dispatch]);

  // render

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left column: zonings tree */}
      <LeftDrawerPanel width={treeWidth} viewerKey="ZONES">
        <BoxFlexVStretch sx={{ height: 1 }}>
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <ZoningsTree />
          </BoxFlexVStretch>
        </BoxFlexVStretch>
      </LeftDrawerPanel>

      {/* Center: map editor */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <MainMapEditorV3 forViewerKey="ZONES" />
      </Box>
    </Box>
  );
}
