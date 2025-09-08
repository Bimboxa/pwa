import { Box } from "@mui/material";
import { useState, useRef, useCallback, useEffect } from "react";

export default function NodeMarkerVariantDot({
  marker,
  bgSize,
  bgPose,
  worldScale,
  onDragEnd,
  onClick,
}) {
  // Convert ratio coordinates (0-1) to pixel coordinates
  const pixelX = marker.x * bgSize.w;
  const pixelY = marker.y * bgSize.h;

  const CLICK_DRAG_TOL = 5;
  const movedRef = useRef(false);

  // Local drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, pixelX: 0, pixelY: 0 });
  const containerRef = useRef(null);

  // Handle drag start
  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();

      setIsDragging(true);
      movedRef.current = false;

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        pixelX: pixelX,
        pixelY: pixelY,
      };
      setDragOffset({ x: 0, y: 0 });

      console.log("Drag started for marker:", marker.id);
    },
    [pixelX, pixelY, marker.id]
  );

  // Handle drag move
  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging) return;

      e.stopPropagation();
      e.preventDefault();

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // 🔥 mark as moved once beyond tolerance
      if (
        !movedRef.current &&
        (Math.abs(deltaX) > CLICK_DRAG_TOL || Math.abs(deltaY) > CLICK_DRAG_TOL)
      ) {
        movedRef.current = true;
      }

      setDragOffset({ x: deltaX, y: deltaY });
    },
    [isDragging]
  );

  // Handle drag end
  const handlePointerUp = useCallback(
    (e) => {
      if (!isDragging) return;

      e.stopPropagation();
      e.preventDefault();

      setIsDragging(false);

      // Calculate new position
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // Convert delta to bgImage local coordinates
      const deltaBgX = deltaX / (worldScale * bgPose.k);
      const deltaBgY = deltaY / (worldScale * bgPose.k);

      // Calculate new position in bgImage local coordinates
      const newPixelX = dragStartRef.current.pixelX + deltaBgX;
      const newPixelY = dragStartRef.current.pixelY + deltaBgY;

      // Convert back to ratio coordinates
      const newRatioX = Math.max(0, Math.min(1, newPixelX / bgSize.w));
      const newRatioY = Math.max(0, Math.min(1, newPixelY / bgSize.h));

      // Call the drag end callback
      if (onDragEnd) {
        onDragEnd(marker.id, { x: newRatioX, y: newRatioY });
      }

      setDragOffset({ x: 0, y: 0 });
    },
    [
      isDragging,
      bgPose.k,
      bgSize.w,
      bgSize.h,
      marker.id,
      marker.x,
      marker.y,
      onDragEnd,
      worldScale,
    ]
  );

  // Add global event listeners for better drag detection
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalPointerMove = (e) => {
      e.preventDefault();
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // 🔥 mark as moved once beyond tolerance (global move as well)
      if (
        !movedRef.current &&
        (Math.abs(deltaX) > CLICK_DRAG_TOL || Math.abs(deltaY) > CLICK_DRAG_TOL)
      ) {
        movedRef.current = true;
      }

      setDragOffset({ x: deltaX, y: deltaY });
    };

    const handleGlobalPointerUp = (e) => {
      e.preventDefault();
      setIsDragging(false);

      // Calculate new position
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // Convert delta to bgImage local coordinates
      const deltaBgX = deltaX / (worldScale * bgPose.k);
      const deltaBgY = deltaY / (worldScale * bgPose.k);

      // Calculate new position in bgImage local coordinates
      const newPixelX = dragStartRef.current.pixelX + deltaBgX;
      const newPixelY = dragStartRef.current.pixelY + deltaBgY;

      // Convert back to ratio coordinates
      const newRatioX = Math.max(0, Math.min(1, newPixelX / bgSize.w));
      const newRatioY = Math.max(0, Math.min(1, newPixelY / bgSize.h));

      console.log("Marker dragged:", {
        markerId: marker.id,
        oldPosition: { x: marker.x, y: marker.y },
        newPosition: { x: newRatioX, y: newRatioY },
      });

      // Call the drag end callback
      if (onDragEnd) {
        onDragEnd(marker.id, { x: newRatioX, y: newRatioY });
      }

      setDragOffset({ x: 0, y: 0 });
    };

    // Add global event listeners
    document.addEventListener("pointermove", handleGlobalPointerMove, {
      passive: false,
    });
    document.addEventListener("pointerup", handleGlobalPointerUp, {
      passive: false,
    });

    return () => {
      document.removeEventListener("pointermove", handleGlobalPointerMove);
      document.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [
    isDragging,
    bgPose.k,
    bgSize.w,
    bgSize.h,
    marker.id,
    marker.x,
    marker.y,
    onDragEnd,
    worldScale,
  ]);

  // Calculate current position with drag offset
  // Account for world scale: dragOffset is in screen coordinates,
  // we need to convert to world coordinates by dividing by worldScale
  const currentX = pixelX + dragOffset.x / (worldScale * bgPose.k);
  const currentY = pixelY + dragOffset.y / (worldScale * bgPose.k);

  // Enlarge the influence zone (make it bigger than the visual marker)
  const influenceSize = 60; // 60px instead of 30px
  const visualSize = 30;

  // handlers

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (isDragging || movedRef.current) return; // ignore click after drag
      onClick?.(marker);
    },
    [isDragging, onClick, marker]
  );

  return (
    <foreignObject
      ref={containerRef}
      x={currentX - influenceSize / 2} // Center the larger influence zone
      y={currentY - influenceSize / 2}
      width={influenceSize}
      height={influenceSize}
      onPointerDown={handlePointerDown}
      style={{
        pointerEvents: "auto",
        userSelect: "none",
      }}
    >
      <Box
        onClick={handleClick}
        sx={{
          width: influenceSize,
          height: influenceSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          "&:hover": { cursor: isDragging ? "grabbing" : "pointer" }, // (pointer on hover)
        }}
      >
        {/* Visual marker (smaller than influence zone) */}
        <Box
          sx={{
            width: visualSize,
            height: visualSize,
            borderRadius: "50%",
            bgcolor: isDragging ? "blue" : "red",
            opacity: isDragging ? 0.8 : 1,
            transition: isDragging ? "none" : "all 0.2s ease",
          }}
        />
      </Box>
    </foreignObject>
  );
}
