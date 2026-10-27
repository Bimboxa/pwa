import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsScanMode } from "Features/viewers/viewersSlice";

import { Box, IconButton, Paper, Tooltip } from "@mui/material";

import { FLOATING_BUTTON_PADDING } from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

import { BASE_MAPS_SCAN_MODE_OPTIONS } from "Features/baseMaps/constants/baseMapsScanMode";

// How the scans carried by base maps show in 3D: hidden, points or
// realistic (Gaussian splats). Same look as SelectorBaseMapsImageMode, next
// to it in the bottom bar (SectionBaseMapsBottomBarControls).
export default function SelectorBaseMapsScanMode() {
  const dispatch = useDispatch();

  // data

  const scanMode = useSelector((s) => s.viewers.baseMapsScanMode);

  // render

  return (
    <Paper
      elevation={3}
      sx={{ borderRadius: "10px", display: "flex", overflow: "hidden" }}
    >
      {BASE_MAPS_SCAN_MODE_OPTIONS.map(({ key, tooltip, Icon }) => {
        const selected = key === scanMode;
        return (
          <Tooltip key={key} title={tooltip}>
            <Box
              sx={{
                display: "flex",
                ...(selected && {
                  bgcolor: "action.active",
                  color: "common.white",
                }),
              }}
            >
              <IconButton
                color={selected ? "inherit" : "default"}
                onClick={() => dispatch(setBaseMapsScanMode(key))}
                sx={{ p: FLOATING_BUTTON_PADDING }}
              >
                <Icon />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}
    </Paper>
  );
}
