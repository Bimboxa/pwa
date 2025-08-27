import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Typography, Box, Button } from "@mui/material";

export default function ListItemBaseMap({ ...baseMap }) {
  const dispatch = useDispatch();

  // string

  const openS = "Ouvrir";

  // state

  const [isOver, setIsOver] = useState(false);

  // handlers

  function handleOpenClick(e) {
    try {
      console.log("open baseMap", baseMap ?? "null");
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();

      dispatch(setSelectedMainBaseMapId(baseMap.id));
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
      <Typography noWrap>{baseMap?.name}</Typography>
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
