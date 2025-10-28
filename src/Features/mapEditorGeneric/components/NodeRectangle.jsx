import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";

export default function NodeRectangle({
  rectangle,
  imageSize,
  containerK = 1,
  worldScale = 1,
  isDrawing = false,
  isPreview = false,
  selected = false,
  onDragEnd,
  onChange,
  onClick,
  toBaseFromClient,
}) {
  const {
    points = [],
    fillColor = "#3b82f6",
    strokeWidth = 2,
    opacity = 0.3,
    rotation = 0,
  } = rectangle;

  // Direct DOM manipulation for preview (no state updates)
  const previewRectRef = useRef(null);
  const mouseMoveHandlerRef = useRef(null);

  // Dragging state for resize/move/rotate
  const draggingRef = useRef({ active: false, mode: null, corner: null });
  const [tempPoints, setTempPoints] = useState(null);
  const tempPointsRef = useRef(null);
  const [tempRotation, setTempRotation] = useState(null);
  const tempRotationRef = useRef(null);

  // reset when first rendering

  useLayoutEffect(() => {
    setTempPoints(null);
    tempPointsRef.current = null;
    setTempRotation(null);
    tempRotationRef.current = null;
  }, [
    rotation +
      "_" +
      points[0].x +
      "_" +
      points[0].y +
      "_" +
      points[1].x +
      "_" +
      points[1].y,
  ]);

  // Mouse tracking for drawing preview - direct DOM manipulation
  useEffect(() => {
    if (!isDrawing || !isPreview || points.length !== 1 || !toBaseFromClient) {
      return;
    }

    const w = imageSize?.w || 1;
    const h = imageSize?.h || 1;
    const firstPoint = points[0];

    function onMove(e) {
      if (!previewRectRef.current) return;

      // Convert client coordinates to base-local px
      const bl = toBaseFromClient(e.clientX, e.clientY);

      // Convert to relative coordinates (0..1)
      const rx = bl.x / w;
      const ry = bl.y / h;

      // Calculate bounds directly
      const x1 = firstPoint.x * w;
      const y1 = firstPoint.y * h;
      const x2 = rx * w;
      const y2 = ry * h;

      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      // Update SVG attributes directly (no React re-render)
      previewRectRef.current.setAttribute("x", x);
      previewRectRef.current.setAttribute("y", y);
      previewRectRef.current.setAttribute("width", width);
      previewRectRef.current.setAttribute("height", height);
    }

    mouseMoveHandlerRef.current = onMove;
    document.addEventListener("mousemove", onMove);

    return () => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener("mousemove", mouseMoveHandlerRef.current);
        mouseMoveHandlerRef.current = null;
      }
    };
  }, [isDrawing, isPreview, points, toBaseFromClient, imageSize]);

  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // Get current points (temp or base)
  const currentPoints = tempPoints || points;

  // Calculate rectangle bounds from two corner points
  const getRectBounds = useCallback(
    (pts) => {
      if (pts.length < 2) {
        // For preview with 1 point, return initial bounds (will be updated by DOM manipulation)
        if (isPreview && pts.length === 1) {
          const p1 = pts[0];
          const x = p1.x * w;
          const y = p1.y * h;
          return { x, y, width: 0, height: 0, p1, p2: p1 };
        }
        return null;
      }

      const [p1, p2] = pts;
      const x1 = p1.x * w;
      const y1 = p1.y * h;
      const x2 = p2.x * w;
      const y2 = p2.y * h;

      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      return { x, y, width, height, p1, p2 };
    },
    [w, h, isPreview]
  );

  const bounds = getRectBounds(currentPoints);

  if (!bounds) {
    return null;
  }

  // Handle corner drag for resize
  const onCornerPointerDown = useCallback(
    (e, corner) => {
      e.preventDefault();
      e.stopPropagation();

      draggingRef.current = { active: true, mode: "resize", corner };
      tempPointsRef.current = [...points];

      const onMove = (e) => {
        if (!draggingRef.current.active || !toBaseFromClient) return;

        const bl = toBaseFromClient(e.clientX, e.clientY);
        const rx = bl.x / w;
        const ry = bl.y / h;

        const [p1, p2] = tempPointsRef.current;

        // Update the corner being dragged
        let newP1 = { ...p1 };
        let newP2 = { ...p2 };

        if (corner === "tl") {
          newP1 = { x: rx, y: ry };
        } else if (corner === "tr") {
          newP1 = { x: p1.x, y: ry };
          newP2 = { x: rx, y: p2.y };
        } else if (corner === "bl") {
          newP1 = { x: rx, y: p1.y };
          newP2 = { x: p2.x, y: ry };
        } else if (corner === "br") {
          newP2 = { x: rx, y: ry };
        }

        tempPointsRef.current = [newP1, newP2];
        setTempPoints([...tempPointsRef.current]);
      };

      const onUp = () => {
        draggingRef.current.active = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (tempPointsRef.current && onChange) {
          onChange({ ...rectangle, points: tempPointsRef.current });
        }
        //tempPointsRef.current = null;
        //setTempPoints(null);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [points, toBaseFromClient, w, h, onChange, rectangle]
  );

  // Handle rectangle body drag for move
  const onBodyPointerDown = useCallback(
    (e) => {
      if (!selected) return;
      e.preventDefault();
      e.stopPropagation();

      const startBl = toBaseFromClient(e.clientX, e.clientY);
      const [p1, p2] = points;
      const startP1 = { ...p1 };
      const startP2 = { ...p2 };

      draggingRef.current = {
        active: true,
        mode: "move",
        startBl,
        startP1,
        startP2,
      };
      tempPointsRef.current = [...points];

      const onMove = (e) => {
        if (!draggingRef.current.active || !toBaseFromClient) return;

        const bl = toBaseFromClient(e.clientX, e.clientY);
        const dx = (bl.x - draggingRef.current.startBl.x) / w;
        const dy = (bl.y - draggingRef.current.startBl.y) / h;

        const newP1 = {
          x: draggingRef.current.startP1.x + dx,
          y: draggingRef.current.startP1.y + dy,
        };
        const newP2 = {
          x: draggingRef.current.startP2.x + dx,
          y: draggingRef.current.startP2.y + dy,
        };

        tempPointsRef.current = [newP1, newP2];
        setTempPoints([...tempPointsRef.current]);
      };

      const onUp = () => {
        draggingRef.current.active = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (tempPointsRef.current && onChange) {
          onChange({ ...rectangle, points: tempPointsRef.current });
        }
        //tempPointsRef.current = null;
        //setTempPoints(null);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [selected, points, toBaseFromClient, w, h, onChange, rectangle]
  );

  // Handle rotation
  const onRotatePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      draggingRef.current = { active: true, mode: "rotate", centerX, centerY };
      tempRotationRef.current = rotation || 0;

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

        tempRotationRef.current = angle;
        setTempRotation(tempRotationRef.current);
      };

      const onUp = () => {
        draggingRef.current.active = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (tempRotationRef.current !== null && onChange) {
          onChange({ ...rectangle, rotation: tempRotationRef.current });
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [bounds, rotation, toBaseFromClient, onChange, rectangle]
  );

  // Data attributes for node detection
  const dataProps = {
    "data-node-id": rectangle?.id,
    "data-node-listing-id": rectangle?.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "RECTANGLE",
  };

  const handleSize = 8 / (containerK * worldScale);
  const currentRotation = tempRotation !== null ? tempRotation : rotation;

  // Calculate rotation handle position (above center)
  const rotateHandleDistance = 30 / (containerK * worldScale);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const rotateHandleX = centerX;
  const rotateHandleY = bounds.y - rotateHandleDistance;

  // Render rectangle with optional resize handles
  return (
    <g>
      {/* Main rectangle */}
      <rect
        ref={isPreview ? previewRectRef : null}
        {...(isDrawing || isPreview ? {} : dataProps)}
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill={fillColor}
        fillOpacity={opacity}
        stroke={fillColor}
        strokeOpacity={1}
        strokeWidth={strokeWidth}
        strokeDasharray={selected ? "4,2" : undefined}
        transform={
          currentRotation
            ? `rotate(${currentRotation} ${centerX} ${centerY})`
            : undefined
        }
        style={{
          cursor: selected ? "move" : "pointer",
          pointerEvents: isPreview ? "none" : "auto",
        }}
        vectorEffect="non-scaling-stroke"
        onPointerDown={selected ? onBodyPointerDown : undefined}
      />

      {/* Resize handles when selected */}
      {selected && (
        <>
          {/* Top-left */}
          <rect
            x={bounds.x - handleSize / 2}
            y={bounds.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke={fillColor}
            strokeWidth={1}
            style={{ cursor: "nwse-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "tl")}
          />
          {/* Top-right */}
          <rect
            x={bounds.x + bounds.width - handleSize / 2}
            y={bounds.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke={fillColor}
            strokeWidth={1}
            style={{ cursor: "nesw-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "tr")}
          />
          {/* Bottom-left */}
          <rect
            x={bounds.x - handleSize / 2}
            y={bounds.y + bounds.height - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke={fillColor}
            strokeWidth={1}
            style={{ cursor: "nesw-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "bl")}
          />
          {/* Bottom-right */}
          <rect
            x={bounds.x + bounds.width - handleSize / 2}
            y={bounds.y + bounds.height - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke={fillColor}
            strokeWidth={1}
            style={{ cursor: "nwse-resize" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => onCornerPointerDown(e, "br")}
          />

          {/* Rotation handle - line connecting to center top */}
          <line
            x1={centerX}
            y1={bounds.y}
            x2={rotateHandleX}
            y2={rotateHandleY}
            stroke={fillColor}
            strokeWidth={1}
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
            transform={
              currentRotation
                ? `rotate(${currentRotation} ${centerX} ${centerY})`
                : undefined
            }
          />

          {/* Rotation handle - circle */}
          <circle
            cx={rotateHandleX}
            cy={rotateHandleY}
            r={handleSize * 0.8}
            fill="white"
            stroke={fillColor}
            strokeWidth={2}
            style={{ cursor: "grab" }}
            vectorEffect="non-scaling-stroke"
            onPointerDown={onRotatePointerDown}
            transform={
              currentRotation
                ? `rotate(${currentRotation} ${centerX} ${centerY})`
                : undefined
            }
          />

          {/* Rotation handle - icon (curved arrow) */}
        </>
      )}
    </g>
  );
}
