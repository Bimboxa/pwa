import { useDispatch } from "react-redux";

import { setSelectedBaseMapViewId } from "../baseMapViewsSlice";

import useSelectedBaseMapViewInEditor from "../hooks/useSelectedBaseMapViewInEditor";

import { Typography, Box, Button } from "@mui/material";

export default function BlockBaseMapViewInEditor() {
  const dispatch = useDispatch();
  // data

  const baseMapView = useSelectedBaseMapViewInEditor();

  console.log("baseMapView", baseMapView);

  // handlers

  function handleClick() {
    dispatch(setSelectedBaseMapViewId(baseMapView.id));
  }

  // render

  return (
    <Box sx={{ p: 0.5, bgcolor: "white", borderRadius: 1 }}>
      <Button onClick={handleClick}>
        <Typography>{baseMapView?.name}</Typography>
      </Button>
    </Box>
  );
}
