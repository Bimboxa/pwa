import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedBaseMapViewIdInEditor } from "../baseMapViewsSlice";

import { Typography, Box, Button } from "@mui/material";

export default function ListItemBaseMapView({ ...baseMapView }) {
  const dispatch = useDispatch();

  // string

  const openS = "Ouvrir";

  // state

  const [isOver, setIsOver] = useState(false);

  // handlers

  function handleOpenClick(e) {
    try {
      console.log("open baseMapView", baseMapView ?? "null");
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();

      dispatch(setSelectedBaseMapViewIdInEditor(baseMapView.id));
    } catch (e) {
      console.error("error opening view", e);
    }
  }

  // helper

  return (
    <Box
      onMouseEnter={() => setIsOver(true)}
      onMouseLeave={() => setIsOver(false)}
      sx={{
        width: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Typography noWrap>{baseMapView?.name}</Typography>
      <Button
        onClick={handleOpenClick}
        size="small"
        sx={{ visibility: isOver ? "visible" : "hidden" }}
      >
        {openS}
      </Button>
    </Box>
  );
}
