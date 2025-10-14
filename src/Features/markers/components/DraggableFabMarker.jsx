import { useDndMonitor, useDraggable } from "@dnd-kit/core";

import { Box } from "@mui/material";
import FabMarker from "./FabMarker";

export default function DraggableFabMarker({
  bgcolor,
  onDragStart,
  onDropped,
}) {
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

  // Visual offset to show marker above finger (in pixels)
  const FINGER_OFFSET_Y = -80; // Show marker 80px above finger

  // handler

  function handleDragStart(event) {
    if (onDragStart) onDragStart();
  }

  function handleDragEnd(event) {
    if (!isCreating) {
      if (onDropped) {
        onDropped(null);
      }
      return;
    }

    const { active, delta } = event;
    const { initial } = active.rect.current;

    // Largeur et hauteur de la Box au départ du drag
    const { width, height, left, top } = initial;

    // Position du coin supérieur gauche après déplacement
    const baseX = left + delta.x;
    const baseY = top + delta.y;

    // Calcul du centre (ajout de la moitié de la largeur et de la hauteur)
    let x = baseX + width / 2;
    let y = baseY + height / 2;

    // Appliquer votre offset vertical si vous décalez visuellement le marqueur
    y += FINGER_OFFSET_Y;

    if (onDropped) {
      onDropped({ x, y });
    }
  }

  const visualOffsetY = isDragging ? FINGER_OFFSET_Y : 0;

  return (
    <Box>
      {/* Draggable marker with offset above finger */}
      <Box
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        sx={{
          display: "flex",
          justifyContent: "center",
          transform: `translate(${transform?.x ?? 0}px, ${
            (transform?.y ?? 0) + visualOffsetY
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
