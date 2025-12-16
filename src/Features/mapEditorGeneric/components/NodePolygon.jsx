import { useMemo, useRef, useState, useCallback, useEffect } from "react";

import NodeLabelStatic from "./NodeLabelStatic";

export default function NodePolygon({
  polygon, // {id,points}
  imageSize,
  containerK,
  worldScale,
  onDragEnd,
  onClick,
}) {
  //if (!polygon?.points || !imageSize?.w || !imageSize?.h) return null;

  // ===== helpers =====
  const scaleToBg = 1 / ((worldScale || 1) * (containerK || 1));
  const composedScale = (worldScale || 1) * (containerK || 1); // used to keep hatch spacing constant

  const CLICK_DRAG_TOL = 5;
  const movedRef = useRef(false);

  // ===== drag state =====
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetScreen, setDragOffsetScreen] = useState({ x: 0, y: 0 });
  const dragRef = useRef({
    startClient: { x: 0, y: 0 },
  });

  // bg-local offset (px) derived from screen offset
  const offsetBgX = dragOffsetScreen.x * scaleToBg;
  const offsetBgY = dragOffsetScreen.y * scaleToBg;

  // ===== path (in bg local px) =====
  const basePathD = useMemo(() => {
    const toPx = ([rx, ry]) => [rx * imageSize.w, ry * imageSize.h];
    const parts = polygon.points.map((ring) => {
      if (!ring?.length) return "";
      const [x0, y0] = toPx(ring[0]);
      const head = `M ${x0} ${y0}`;
      const tail = ring
        .slice(1)
        .map(([rx, ry]) => {
          const [x, y] = toPx([rx, ry]);
          return `L ${x} ${y}`;
        })
        .join(" ");
      return `${head} ${tail} Z`;
    });
    return parts.join(" ");
  }, [polygon?.points, imageSize?.w, imageSize?.h]);

  // ===== styles that stay visually constant with zoom =====
  const strokeWidthPx = 2; // thanks to vectorEffect, this remains constant visually
  const hatchBase = 12; // desired visual spacing in px
  const hatchSize = hatchBase * scaleToBg; // inversely scale so it looks constant on screen
  const hatchStroke = 1.5 * scaleToBg;

  // Unique pattern id per polygon
  const patternIdRef = useRef(
    `hatch-${polygon.id}-${Math.random().toString(36).slice(2)}`
  );
  const patternId = patternIdRef.current;

  // ===== pointer handlers (mirror NodeMarkerVariantDot behavior) =====
  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    movedRef.current = false;
    dragRef.current.startClient = { x: e.clientX, y: e.clientY };
    setDragOffsetScreen({ x: 0, y: 0 });
  }, []);

  const handlePointerMoveLocal = useCallback((clientX, clientY) => {
    const dx = clientX - dragRef.current.startClient.x;
    const dy = clientY - dragRef.current.startClient.y;

    if (
      !movedRef.current &&
      (Math.abs(dx) > CLICK_DRAG_TOL || Math.abs(dy) > CLICK_DRAG_TOL)
    ) {
      movedRef.current = true;
    }
    setDragOffsetScreen({ x: dx, y: dy });
  }, []);

  const handlePointerUpLocal = useCallback(
    (clientX, clientY) => {
      setIsDragging(false);

      const dx = clientX - dragRef.current.startClient.x;
      const dy = clientY - dragRef.current.startClient.y;

      // Click?
      if (!movedRef.current) {
        onClick?.(polygon);
        setDragOffsetScreen({ x: 0, y: 0 });
        return;
      }

      // Convert to bg-local delta
      const dxBg = dx * scaleToBg;
      const dyBg = dy * scaleToBg;

      // Apply delta to each point, convert back to ratio
      const newPointsRatio = polygon.points.map((ring) =>
        ring.map(([rx, ry]) => {
          const px = rx * imageSize.w + dxBg;
          const py = ry * imageSize.h + dyBg;
          return [px / imageSize.w, py / imageSize.h];
        })
      );

      onDragEnd?.(polygon.id, { points: newPointsRatio });

      setDragOffsetScreen({ x: 0, y: 0 });
    },
    [onClick, onDragEnd, polygon, scaleToBg, imageSize.w, imageSize.h]
  );

  // Attach global listeners while dragging (like NodeMarkerVariantDot)
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e) => {
      e.preventDefault();
      handlePointerMoveLocal(e.clientX, e.clientY);
    };
    const onUp = (e) => {
      e.preventDefault();
      handlePointerUpLocal(e.clientX, e.clientY);
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp, { passive: false });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, handlePointerMoveLocal, handlePointerUpLocal]);

  // ===== render =====
  return (
    <g
      onPointerDown={handlePointerDown}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        pointerEvents: "auto",
      }}
    >
      <defs>
        {/* Cross-hatch pattern. We use userSpaceOnUse + tile size inversely scaled
            so spacing looks constant while zooming/panning. */}
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={hatchSize}
          height={hatchSize}
        >
          <path
            d={`M 0 0 L ${hatchSize} ${hatchSize}`}
            stroke="red"
            strokeWidth={hatchStroke}
          />
          <path
            d={`M 0 ${hatchSize} L ${hatchSize} 0`}
            stroke="red"
            strokeWidth={hatchStroke}
          />
        </pattern>
      </defs>

      {/* Live drag preview by translating the path in bg-local space */}
      <g transform={`translate(${offsetBgX}, ${offsetBgY})`}>
        <path
          d={basePathD}
          fill={`url(#${patternId})`}
          fillRule="evenodd" // respects holes
          stroke="red"
          strokeWidth={strokeWidthPx}
          vectorEffect="non-scaling-stroke" // keeps stroke constant on zoom
          pointerEvents="visiblePainted"
        />
        {/* Fat transparent stroke as an easier grab handle */}
        <path
          d={basePathD}
          fill="transparent"
          stroke="transparent"
          strokeWidth={Math.max(12 * scaleToBg, strokeWidthPx)}
          pointerEvents="stroke"
        />
      </g>

    </g>
  );
}
