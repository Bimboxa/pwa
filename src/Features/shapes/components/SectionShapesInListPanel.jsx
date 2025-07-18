import React from "react";

import { useDispatch, useSelector } from "react-redux";

import useShapes from "../hooks/useShapes";

import { setSelectedShapeId } from "Features/shapes/shapesSlice";

import { ListItemButton, List, Typography, Box } from "@mui/material";

export default function SectionShapesInListPanel() {
  const dispatch = useDispatch();

  // data

  const mapId = useSelector((s) => s.maps.selectedBaseMapId);
  const shapes = useShapes({
    widthSelected: true,
    filterByMapId: mapId,
  });

  const selectedShapeId = useSelector((s) => s.shapes.selectedShapeId);

  // handlers

  function handleClick(shape) {
    const id = shape.id === selectedShapeId ? null : shape.id;
    dispatch(setSelectedShapeId(id));
  }

  return (
    <Box sx={{ height: 1, overflowY: "auto" }}>
      <List>
        {shapes.map((shape) => {
          const surfaceS = shape.surface
            ? ` Surface: ${shape.surface.toFixed(1)} m²`
            : "";
          const lengthS = shape.surface
            ? ` Périmètre: ${shape.length.toFixed(2)} m`
            : "";

          return (
            <ListItemButton
              key={shape.id}
              selected={shape.selected}
              onClick={() => handleClick(shape)}
              divider
            >
              <Box>
                <Typography>{shape.label}</Typography>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {lengthS}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {surfaceS}
                  </Typography>
                </Box>
              </Box>
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
