import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Architecture as Scale } from "@mui/icons-material";
import { IconButton, Box } from "@mui/material";

export default function ButtonEditScale() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setEnabledDrawingMode("SEGMENT"));
    dispatch(setNewAnnotation({ ...newAnnotation, isScaleSegment: true }));
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
      <IconButton onClick={handleClick} color="inherit">
        <Scale />
      </IconButton>
    </Box>
  );
}
