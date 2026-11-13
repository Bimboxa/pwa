import { Box, IconButton, Paper, Tooltip } from "@mui/material";

import { FLOATING_BUTTON_PADDING } from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";
import { IMAGES_DISPLAY_MODE_OPTIONS } from "../constants/imagesDisplayModeOptions";

// How the photos (IMAGE annotations) show: in situ (on the base map), overlay
// (floating PopperImages panel) or print zones (tiles along the 4 edges).
// 3-button group, same look as SelectorBaseMapsImageMode (the selected mode
// gets the action color as background). Used by the bottom bar
// (SectionImagesBottomBarControls) and by the capture tool, whose framing
// hides the bottom bar controls.
export default function SelectorImagesDisplayMode({ dense = false }) {
  // data

  const { displayMode, setDisplayMode } = useImagesDisplaySettings();

  // render

  return (
    <Paper
      elevation={3}
      sx={{ borderRadius: "10px", display: "flex", overflow: "hidden" }}
    >
      {IMAGES_DISPLAY_MODE_OPTIONS.map(({ key, tooltip, Icon }) => {
        const selected = key === displayMode;
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
                onClick={() => setDisplayMode(key)}
                sx={{ p: dense ? "3px" : FLOATING_BUTTON_PADDING }}
              >
                <Icon fontSize={dense ? "small" : "medium"} />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}
    </Paper>
  );
}
