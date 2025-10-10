import { useDndMonitor, useDraggable } from "@dnd-kit/core";

import { useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { createMarker } from "../markersSlice";

import { Box } from "@mui/material";
import FabMarker from "./FabMarker";
import useLoadedMainBaseMap from "Features/mapEditor/hooks/useLoadedMainBaseMap";
import getPointerPositionInStage from "Features/mapEditor/utils/getPointerPositionInStage";

import editor from "App/editor";

export default function DraggableFabMarker({ bgcolor, onDropped }) {
  const dispatch = useDispatch();
  // data

  const loadedMainBaseMap = useLoadedMainBaseMap();

  // data - dnd

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: "marker",
    });
  useDndMonitor({ onDragEnd: handleDragEnd, onDragStart: handleDragStart });

  // helpers - dnd

  const deltaX = Math.abs(transform?.x ?? 0);
  const deltaY = Math.abs(transform?.y ?? 0);
  const maxDelta = Math.max(deltaX, deltaY);
  const isCreating = maxDelta > 20; // start the creation process

  // handler

  function handleDragStart(event) {}

  function handleDragEnd(event) {
    // edge case
    if (!isCreating) {
      return;
    }

    // main
    const { activatorEvent, delta } = event;
    let pointer = { x: 0, y: 0 };
    if (activatorEvent.clientX || activatorEvent.clientY) {
      pointer = {
        x: activatorEvent.clientX + delta.x ?? 0,
        y: activatorEvent.clientY + delta.y ?? 0,
      };
    } else if (activatorEvent.touches?.[0]) {
      pointer = {
        x: activatorEvent.touches[0].clientX + delta.x ?? 0,
        y: activatorEvent.touches[0].clientY + delta.y ?? 0,
      };
    }

    const stage = editor.mapEditor.stage;
    const pointInStage = getPointerPositionInStage(pointer, stage, {
      coordsInWindow: true,
    });
    const x = pointInStage.x / loadedMainBaseMap.imageWidth;
    const y = pointInStage.y / loadedMainBaseMap.imageHeight;

    const newMarker = {
      id: nanoid(),
      x,
      y,
      mapId: loadedMainBaseMap.id,
    };

    if (onDropped) onDropped({ x, y, mapId: newMarker.mapId });
  }

  return (
    <Box>
      <Box
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        sx={{
          display: "flex",
          justifyContent: "center",

          transform: `translate(${transform?.x ?? 0}px, ${
            transform?.y ?? 0
          }px)`,
          position: "relative",
          touchAction: "manipulation",
        }}
      >
        <FabMarker bgcolor={bgcolor} isCreating={isCreating} />
      </Box>
    </Box>
  );
}
