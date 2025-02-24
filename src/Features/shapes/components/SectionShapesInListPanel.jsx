import React from "react";

import {useDispatch, useSelector} from "react-redux";

import useShapes from "../hooks/useShapes";

import {setSelectedShapeId} from "Features/shapes/shapesSlice";

import {ListItemButton, List, Typography, Box} from "@mui/material";

export default function SectionShapesInListPanel() {
  const dispatch = useDispatch();

  // data

  const shapes = useShapes({widthSelected: true});

  const selectedShapeId = useSelector((s) => s.shapes.selectedShapeId);

  // handlers

  function handleClick(shape) {
    const id = shape.id === selectedShapeId ? null : shape.id;
    dispatch(setSelectedShapeId(id));
  }

  return (
    <Box sx={{height: 1, overflowY: "auto"}}>
      <List>
        {shapes.map((shape) => (
          <ListItemButton
            key={shape.id}
            selected={shape.selected}
            onClick={() => handleClick(shape)}
            divider
          >
            <Typography>{shape.name}</Typography>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
