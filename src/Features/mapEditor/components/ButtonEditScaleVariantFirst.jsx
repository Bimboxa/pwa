import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "../hooks/useMainBaseMap";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Architecture as Scale } from "@mui/icons-material";
import { Button, IconButton, Box, Paper, Tooltip } from "@mui/material";

import theme from "Styles/theme";

export default function ButtonEditScaleVariantFirst() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const noScale = Boolean(baseMap) && !baseMap.meterByPx;

  // handler

  function handleClick() {
    dispatch(setEnabledDrawingMode("MEASURE"));
    dispatch(setNewAnnotation(
      {
        type: "MEASURE",
        strokeColor: theme.palette.secondary.main,
        strokeWidth: 2,
        strokeWidthUnit: "PX",
      }
    ));
  }

  if (enabledDrawingMode === "MEASURE") {
    return null;
  }

  if (noScale) {
    return (
      <Button
        variant="contained"
        color="secondary"
        startIcon={<Scale />}
        onClick={handleClick}
      >
        Mettre à l&apos;échelle
      </Button>
    );
  }

  return (
    <Paper
      sx={{
        borderRadius: "8px",
        transition: "all 0.2s ease",
        bgcolor: "background.paper",
        border: "none",
        display: "inline-flex",
        overflow: "hidden",
        "&:hover": {
          elevation: 6,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ p: 0.5 }}>
        <Tooltip title="Prendre une cote">
          <IconButton onClick={handleClick} >
            <Scale />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}
