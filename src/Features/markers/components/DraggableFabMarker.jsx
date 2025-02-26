import {useDndMonitor, useDraggable} from "@dnd-kit/core";

import {Box} from "@mui/material";
import FabMarker from "./FabMarker";

export default function DraggableFabMarker() {
  // data - dnd

  const {attributes, listeners, setNodeRef, transform, isDragging} =
    useDraggable({
      id: "marker",
    });
  useDndMonitor({onDragEnd: handleDragEnd, onDragStart: handleDragStart});

  // helpers - dnd

  const deltaX = Math.abs(transform?.x ?? 0);
  const deltaY = Math.abs(transform?.y ?? 0);
  const maxDelta = Math.max(deltaX, deltaY);
  const isCreating = maxDelta > 20; // start the creation process

  // handler

  function handleDragStart(event) {}

  function handleDragEnd(event) {
    const {activatorEvent, delta} = event;
    let pointer = {x: 0, y: 0};
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
    const point = getPointerCoordsInStage(pointer, stage);
  }

  return (
    <Box sx={{position: "fixed", zIndex: 2, top: "64px", right: "16px"}}>
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
        <FabMarker />
      </Box>
    </Box>
  );
}
