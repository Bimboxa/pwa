import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsImageMode } from "Features/viewers/viewersSlice";

import { Box, IconButton, Paper, Tooltip } from "@mui/material";

import { BASE_MAPS_IMAGE_MODE_OPTIONS } from "Features/baseMaps/constants/baseMapsImageMode";

// How the base map images show: hidden (annotations only), faded (light
// grey, the annotations stand out) or as is. Same global state as the
// "Fonds de plan" module panel (SectionBaseMapsImageMode): it applies to
// every 2D editor, to the 3D scene and to the base maps grid. Floating
// 3-button group of the top-right row of the editors (same look as
// ButtonBaseMapsGrid / ButtonZoomOutMap).
export default function SelectorBaseMapsImageMode() {
  const dispatch = useDispatch();

  // data

  const imageMode = useSelector((s) => s.viewers.baseMapsImageMode);

  // render

  return (
    <Paper
      elevation={3}
      sx={{ borderRadius: "10px", display: "flex", overflow: "hidden" }}
    >
      {BASE_MAPS_IMAGE_MODE_OPTIONS.map(({ key, tooltip, Icon }) => {
        const selected = key === imageMode;
        return (
          <Tooltip key={key} title={tooltip}>
            <Box
              sx={{
                display: "flex",
                ...(selected && {
                  bgcolor: "grey.900",
                  color: "common.white",
                }),
              }}
            >
              <IconButton
                size="small"
                color="inherit"
                onClick={() => dispatch(setBaseMapsImageMode(key))}
              >
                <Icon fontSize="small" />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}
    </Paper>
  );
}
