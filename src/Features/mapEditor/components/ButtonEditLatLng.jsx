import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Public as LatLngIcon } from "@mui/icons-material";
import { IconButton, Box, Tooltip } from "@mui/material";

export default function ButtonEditLatLng({ size = "medium" }) {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();

  // handler

  function handleClick() {
    dispatch(setEnabledDrawingMode("LAT_LNG"));
    console.log("latLng", baseMap?.latLng);
  }

  return (
    <Box
      sx={{
        bgcolor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Tooltip title="Géolocaliser le fond de plan">
        <IconButton onClick={handleClick} color="inherit" size={size}>
          <LatLngIcon fontSize={size} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
