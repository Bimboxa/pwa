import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";

export default function NodeImageAnnotation({
  imageAnnotation,
  imageSize,
  baseMapMeterByPx, // Scale factor of the baseMap (meters per pixel)
  containerK = 1,
  worldScale = 1,
  selected = false,
  onDragEnd,
  onChange,
  onClick,
  toBaseFromClient,
}) {
  const {
    x = 0.5, // center position in relative coords (0-1)
    y = 0.5,
    rotation = 0,
    meterByPx: imageMeterByPx, // Scale factor of the image annotation
  } = imageAnnotation;

  // Get image data from entity
  const imageUrl = imageAnnotation?.image?.imageUrlClient;
  const imageWidthPx = imageAnnotation?.image?.imageSize?.width; // Image actual width in px
  const imageHeightPx = imageAnnotation?.image?.imageSize?.height; // Image actual height in px

  const addBg = imageAnnotation?.addBg;

  // Determine if resize is disabled based on presence of imageMeterByPx
  const disableResize = Boolean(imageMeterByPx);

  // Calculate display dimensions in baseMap coordinate system
  let displayWidth, displayHeight;

  if (disableResize) {
    // CASE 1: disableResize = true (imageMeterByPx exists)
    // Size is computed from scale factors, resize handlers are hidden
    if (imageWidthPx && imageHeightPx && imageMeterByPx && baseMapMeterByPx) {
      // Image real-world width in meters = imageWidthPx * imageMeterByPx
      // BaseMap pixels needed = (image meters) / baseMapMeterByPx
      displayWidth = (imageWidthPx * imageMeterByPx) / baseMapMeterByPx;
      displayHeight = (imageHeightPx * imageMeterByPx) / baseMapMeterByPx;
    } else if (imageWidthPx && imageHeightPx) {
      // No baseMap scale factor, use default 100px width with aspect ratio
      const aspectRatio = imageHeightPx / imageWidthPx;
      displayWidth = 100;
      displayHeight = 100 * aspectRatio;
    } else {
      // Fallback
      displayWidth = 100;
      displayHeight = 100;
    }
  } else {
    // CASE 2: disableResize = false (no imageMeterByPx)
    // Size can be manually changed via resize handlers
    // meterByPx is NOT used in this case
    displayWidth = imageAnnotation?.width;
    displayHeight = imageAnnotation?.height;

    // If no stored dimensions, compute from image with default 100px width
    if (!displayWidth && !displayHeight && imageWidthPx && imageHeightPx) {
      const aspectRatio = imageHeightPx / imageWidthPx;
      displayWidth = 100;
      displayHeight = 100 * aspectRatio;
    }

    // Final fallback
    if (!displayWidth) displayWidth = 100;
    if (!displayHeight) displayHeight = 100;
  }

  // Dragging state for resize/move/rotate
  const draggingRef = useRef({ active: false, mode: null, corner: null });
  const [tempState, setTempState] = useState(null);
  const tempStateRef = useRef(null);

  // reset when first rendering
  useLayoutEffect(() => {
    setTempState(null);
    tempStateRef.current = null;
  }, [x + "_" + y + "_" + rotation + "_" + displayWidth + "_" + displayHeight]);

  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // Get current state (temp or base)
  // Use displayWidth/displayHeight as the default size
  const currentState = tempState || {
    x,
    y,
    width: displayWidth,
    height: displayHeight,
    rotation,
  };

  // Convert relative position to pixel position (top-left corner)
  const centerX = currentState.x * w;
  const centerY = currentState.y * h;
  const imgX = centerX - currentState.width / 2;
  const imgY = centerY - currentState.height / 2;

  // Handle corner drag for resize
  const onCornerPointerDown = useCallback(
    (e, corner) => {
      e.preventDefault();
      e.stopPropagation();

      draggingRef.current = { active: true, mode: "resize", corner };
      tempStateRef.current = { ...currentState };

      const onMove = (e) => {
        if (!draggingRef.current.active || !toBaseFromClient) return;

        const bl = toBaseFromClient(e.clientX, e.clientY);

        // Calculate new dimensions based on corner being dragged
        const newCenterX = currentState.x * w;
        const newCenterY = currentState.y * h;

        let newWidth = currentState.width;
        let newHeight = currentState.height;
        let newX = currentState.x;
        let newY = currentState.y;

        if (corner === "tl") {
          const dx = bl.x - (newCenterX - currentState.width / 2);
          const dy = bl.y - (newCenterY - currentState.height / 2);
          newWidth = currentState.width - dx;
          newHeight = currentState.height - dy;
          newX = (newCenterX + dx / 2) / w;
          newY = (newCenterY + dy / 2) / h;
        } else if (corner === "tr") {
          const dx = bl.x - (newCenterX + currentState.width / 2);
          const dy = bl.y - (newCenterY - currentState.height / 2);
          newWidth = currentState.width + dx;
          newHeight = currentState.height - dy;
          newX = (newCenterX + dx / 2) / w;
          newY = (newCenterY + dy / 2) / h;
        } else if (corner === "bl") {
          const dx = bl.x - (newCenterX - currentState.width / 2);
          const dy = bl.y - (newCenterY + currentState.height / 2);
          newWidth = currentState.width - dx;
          newHeight = currentState.height + dy;
          newX = (newCenterX + dx / 2) / w;
          newY = (newCenterY + dy / 2) / h;
        } else if (corner === "br") {
          const dx = bl.x - (newCenterX + currentState.width / 2);
          const dy = bl.y - (newCenterY + currentState.height / 2);
          newWidth = currentState.width + dx;
          newHeight = currentState.height + dy;
          newX = (newCenterX + dx / 2) / w;
          newY = (newCenterY + dy / 2) / h;
        }

        // Ensure minimum size
        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);

        tempStateRef.current = {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          rotation: currentState.rotation,
        };
        setTempState({ ...tempStateRef.current });
      };

      const onUp = () => {
        draggingRef.current.active = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (tempStateRef.current && onChange) {
          onChange({ ...imageAnnotation, ...tempStateRef.current });
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [currentState, toBaseFromClient, w, h, onChange, imageAnnotation]
  );

  // Handle image body drag for move
  const onBodyPointerDown = useCallback(
    (e) => {
      if (!selected) {
        onClick?.(imageAnnotation);
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const startBl = toBaseFromClient(e.clientX, e.clientY);
      const startX = currentState.x;
      const startY = currentState.y;

      draggingRef.current = {
        active: true,
        mode: "move",
        startBl,
        startX,
        startY,
      };
      tempStateRef.current = { ...currentState };

      const onMove = (e) => {
        if (!draggingRef.current.active || !toBaseFromClient) return;

        const bl = toBaseFromClient(e.clientX, e.clientY);
        const dx = (bl.x - draggingRef.current.startBl.x) / w;
        const dy = (bl.y - draggingRef.current.startBl.y) / h;

        const newX = draggingRef.current.startX + dx;
        const newY = draggingRef.current.startY + dy;

        tempStateRef.current = {
          ...currentState,
          x: newX,
          y: newY,
        };
        setTempState({ ...tempStateRef.current });
      };

      const onUp = () => {
        draggingRef.current.active = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (tempStateRef.current && onChange) {
          onChange({ ...imageAnnotation, ...tempStateRef.current });
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [
      selected,
      currentState,
      toBaseFromClient,
      w,
      h,
      onChange,
      imageAnnotation,
      onClick,
    ]
  );

  // Handle rotation
  const onRotatePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const centerPxX = currentState.x * w;
      const centerPxY = currentState.y * h;

      draggingRef.current = {
        active: true,
        mode: "rotate",
        centerX: centerPxX,
        centerY: centerPxY,
      };
      tempStateRef.current = { ...currentState };

      const SNAP_THRESHOLD = 3; // Degrees - snap to 0° when within this range

      const onMove = (e) => {
        if (!draggingRef.current.active || !toBaseFromClient) return;

        const bl = toBaseFromClient(e.clientX, e.clientY);

        // Calculate angle from center to mouse position
        const dx = bl.x - draggingRef.current.centerX;
        const dy = bl.y - draggingRef.current.centerY;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        angle = angle + 90; // +90 to align with top = 0°

        // Normalize angle to 0-360 range
        angle = ((angle % 360) + 360) % 360;

        // Snap to 0° when close
        if (angle <= SNAP_THRESHOLD || angle >= 360 - SNAP_THRESHOLD) {
          angle = 0;
        }

        tempStateRef.current = {
          ...currentState,
          rotation: angle,
        };
        setTempState({ ...tempStateRef.current });
      };

      const onUp = () => {
        draggingRef.current.active = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (tempStateRef.current && onChange) {
          onChange({ ...imageAnnotation, ...tempStateRef.current });
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [currentState, w, h, toBaseFromClient, onChange, imageAnnotation]
  );

  // Data attributes for node detection
  const dataProps = {
    "data-node-id": imageAnnotation?.id,
    "data-node-listing-id": imageAnnotation?.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "IMAGE",
  };

  const handleSize = 8 / (containerK * worldScale);

  // Calculate rotation handle position (above center)
  const rotateHandleDistance = 30 / (containerK * worldScale);
  const rotateHandleX = centerX;
  const rotateHandleY = imgY - rotateHandleDistance;

  if (!imageUrl) {
    return null;
  }

  // Render image with optional resize handles
  return (
    <g>
      {/* White background rectangle (if addBg is true) */}
      {addBg && (
        <rect
          x={imgX}
          y={imgY}
          width={currentState.width}
          height={currentState.height}
          fill="white"
          transform={
            currentState.rotation
              ? `rotate(${currentState.rotation} ${centerX} ${centerY})`
              : undefined
          }
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Main image */}
      <image
        {...dataProps}
        href={imageUrl}
        x={imgX}
        y={imgY}
        width={currentState.width}
        height={currentState.height}
        preserveAspectRatio="none"
        transform={
          currentState.rotation
            ? `rotate(${currentState.rotation} ${centerX} ${centerY})`
            : undefined
        }
        style={{
          cursor: selected ? "move" : "pointer",
          pointerEvents: "auto",
          filter: selected ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "none",
        }}
        onPointerDown={onBodyPointerDown}
      />

      {/* Selection outline when selected */}
      {selected && (
        <rect
          x={imgX}
          y={imgY}
          width={currentState.width}
          height={currentState.height}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2 / (containerK * worldScale)}
          strokeDasharray="4,2"
          transform={
            currentState.rotation
              ? `rotate(${currentState.rotation} ${centerX} ${centerY})`
              : undefined
          }
          style={{ pointerEvents: "none" }}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Resize handles when selected - only shown if !disableResize */}
      {selected && !disableResize && (
        <>
          {/* Top-left */}
          <rect
            x={imgX - handleSize / 2}
            y={imgY - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1}
            style={{ cursor: "nwse-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "tl")}
          />
          {/* Top-right */}
          <rect
            x={imgX + currentState.width - handleSize / 2}
            y={imgY - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1}
            style={{ cursor: "nesw-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "tr")}
          />
          {/* Bottom-left */}
          <rect
            x={imgX - handleSize / 2}
            y={imgY + currentState.height - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1}
            style={{ cursor: "nesw-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "bl")}
          />
          {/* Bottom-right */}
          <rect
            x={imgX + currentState.width - handleSize / 2}
            y={imgY + currentState.height - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1}
            style={{ cursor: "nwse-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "br")}
          />
        </>
      )}

      {/* Rotation handle - always shown when selected */}
      {selected && (
        <>
          {/* Rotation handle - line connecting to center top */}
          <line
            x1={centerX}
            y1={imgY}
            x2={rotateHandleX}
            y2={rotateHandleY}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
            transform={
              currentState.rotation
                ? `rotate(${currentState.rotation} ${centerX} ${centerY})`
                : undefined
            }
          />

          {/* Rotation handle - circle */}
          <circle
            cx={rotateHandleX}
            cy={rotateHandleY}
            r={handleSize * 0.8}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            style={{ cursor: "grab" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={onRotatePointerDown}
            transform={
              currentState.rotation
                ? `rotate(${currentState.rotation} ${centerX} ${centerY})`
                : undefined
            }
          />
        </>
      )}
    </g>
  );
}
