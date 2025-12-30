import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "../hooks/useMainBaseMap";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Architecture as Scale } from "@mui/icons-material";
import { IconButton, Box, Typography } from "@mui/material";
import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import theme from "Styles/theme";

export default function ButtonEditScaleVariantFirst() {
  const dispatch = useDispatch();

  // strings

  const label = "Définir une échelle";

  // data

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);


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
    return null
  }

  if (meterByPx) return <Box sx={{
    display: "flex", alignItems: "center", gap: 1,
    bgcolor: "white",
    borderRadius: "50%", border: theme => `1px solid ${theme.palette.divider}`
  }}>
    <IconButton onClick={handleClick} size="small">
      <Scale fontSize="small" />
    </IconButton>
  </Box>;


  return (

    // <Box sx={{ display: "flex", alignItems: "center", borderRadius: "8px", bgcolor: "white", p: 0.5, gap: 1, border: theme => `1px solid ${theme.palette.secondary.main}` }}>
    //   <IconButtonToolbarGeneric onClick={handleClick} size={32} label={label}>
    //     <Scale fontSize="small" />
    //   </IconButtonToolbarGeneric>
    // </Box>

    <ButtonGeneric
      onClick={handleClick}
      size={"small"}
      label={label}
      startIcon={<Scale />}
      variant="contained"
      color="secondary"
    />

  );
}
