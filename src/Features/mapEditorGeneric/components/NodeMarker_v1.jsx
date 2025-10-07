import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import spriteImageUrl from "Features/markers/assets/spriteImage3x3.png";

/**
 * Draggable SVG marker:
 * - marker: { id, x, y, iconColor?, iconType? }   // x,y are ratios (0..1) of BG image
 * - imageSize:  { w, h }                              // BG image intrinsic pixels
 * - containerK: number                             // scale of container layer
 * - worldScale: number                             // world.k (zoom)
 * - iconColor: string (overrides marker.iconColor)
 * - iconType:  number|string (index 0..8, or a name mapped below)
 * - onDragEnd(id, {x,y}): x,y are ratios (0..1)
 * - onClick(marker)
 */
export default function NodeMarker({
  marker,
  spriteImage,
  imageSize,
  containerK,
  worldScale,
  onDragEnd,
  onClick,
  selected,
}) {
  // --- dataProps ---

  const dataProps = {
    "data-node-id": marker.id,
    "data-node-listing-id": marker.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "MARKER",
  };

  // --- markerProps ----

  const label = marker?.entity?.num;

  // --- hide when stop draging to avoid blink

  const [hide, setHide] = useState(false);

  // --- dragging/selection ----

  const draggingEnabled = selected;

  // ---- sprite selection (3x3 grid) ----
  const {
    iconKeys,
    columns,
    rows,
    tile,
    url: spriteImageUrl,
  } = spriteImage ?? {};

  const resolvedIndex = iconKeys?.indexOf(marker?.iconKey) ?? 0;
  const row = Math.floor(resolvedIndex / columns);
  const col = resolvedIndex % columns;
  const sheetW = columns * tile;
  const sheetH = rows * tile; // 3x3

  // ---- sizes that should look constant on screen ----
  const F = useMemo(
    () => (worldScale || 1) * (containerK || 1),
    [worldScale, containerK]
  );
  const invF = 1 / F;

  const circleDiameterPx = 32; // visual diameter in CSS px
  const iconSizePx = 32; // visual icon size in CSS px
  const hitStrokePx = 24; // easier grab ring in CSS px

  // const rLocal = (circleDiameterPx / 2) * invF; // circle radius in BG-local px
  // const iconLocal = iconSizePx * invF; // icon box size in BG-local px
  // const hitStrokeLocal = Math.max(hitStrokePx * invF, 8 * invF);

  const rLocal = circleDiameterPx / 2;
  const iconLocal = iconSizePx;
  const hitStrokeLocal = Math.max(hitStrokePx * invF, 8 * invF);

  const fillColor = marker?.fillColor ?? "#f44336";

  // ---- position (convert ratio -> BG-local px) + live drag offset ----
  const pixelX = (marker.x || 0) * (imageSize?.w || 0);
  const pixelY = (marker.y || 0) * (imageSize?.h || 0);

  const CLICK_DRAG_TOL = 5;
  const movedRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetScreen, setDragOffsetScreen] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const offsetBgX = dragOffsetScreen.x * invF;
  const offsetBgY = dragOffsetScreen.y * invF;

  const currentX = pixelX + offsetBgX;
  const currentY = pixelY + offsetBgY;

  // ---- pointer handlers (SVG version of NodeMarkerVariantDot) ----

  const handleClick = () => {
    //if (onClick) onClick(marker);
  };

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!draggingEnabled) return;
      setIsDragging(true);
      movedRef.current = false;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        px: pixelX,
        py: pixelY,
      };
      setDragOffsetScreen({ x: 0, y: 0 });
    },
    [pixelX, pixelY, draggingEnabled]
  );

  const handlePointerMoveLocal = useCallback((clientX, clientY) => {
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    if (
      !movedRef.current &&
      (Math.abs(dx) > CLICK_DRAG_TOL || Math.abs(dy) > CLICK_DRAG_TOL)
    ) {
      movedRef.current = true;
    }
    setDragOffsetScreen({ x: dx, y: dy });
  }, []);

  const commitDrag = useCallback(
    (clientX, clientY) => {
      setIsDragging(false);
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      if (!movedRef.current) {
        onClick?.(marker);
        setDragOffsetScreen({ x: 0, y: 0 });
        return;
      }

      // delta in BG-local px
      const dxBg = dx * invF;
      const dyBg = dy * invF;

      // new BG-local
      const newPx = dragStartRef.current.px + dxBg;
      const newPy = dragStartRef.current.py + dyBg;

      // back to ratios
      const newRatioX = Math.max(0, Math.min(1, newPx / (imageSize?.w || 1)));
      const newRatioY = Math.max(0, Math.min(1, newPy / (imageSize?.h || 1)));

      console.log("debug_1809_newRatio", newRatioX, newRatioY);
      onDragEnd?.({ id: marker.id, x: newRatioX, y: newRatioY });
      setDragOffsetScreen({ x: 0, y: 0 });
    },
    [invF, imageSize?.w, imageSize?.h, onDragEnd, onClick, marker]
  );

  // global listeners like the dot variant
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      e.preventDefault();
      handlePointerMoveLocal(e.clientX, e.clientY);
    };
    const onUp = (e) => {
      e.preventDefault();
      commitDrag(e.clientX, e.clientY);
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp, { passive: false });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, handlePointerMoveLocal, commitDrag]);

  // ---- render ----
  return (
    <g
      transform={`translate(${currentX}, ${currentY})`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      style={{
        visibility: hide ? "hidden" : "visible",
        cursor: isDragging ? "grabbing" : "pointer",
        pointerEvents: "auto",
        filter: selected ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "none",
      }}
      {...dataProps}
    >
      {/* Filled circle background */}
      <circle
        cx={0}
        cy={0}
        r={selected ? rLocal * 1.2 : rLocal}
        fill={fillColor}
        opacity={0.9}
        vectorEffect="non-scaling-stroke"
        scale={selected ? 1.2 : 1}
        {...dataProps}
      />

      {/* Icon from sprite, centered */}
      {spriteImageUrl && (
        <svg
          x={-iconLocal / 2}
          y={-iconLocal / 2}
          width={iconLocal}
          height={iconLocal}
          viewBox={`${col * tile} ${row * tile} ${tile} ${tile}`}
          style={{ pointerEvents: "none" }}
        >
          <image
            href={spriteImageUrl}
            width={sheetW}
            height={sheetH}
            preserveAspectRatio="none"
          />
        </svg>
      )}

      {/* Fat transparent ring for easy grab, doesn't change visual */}
      <circle
        cx={0}
        cy={0}
        r={rLocal}
        fill="transparent"
        stroke="transparent"
        strokeWidth={hitStrokeLocal}
        pointerEvents="stroke"
      />
    </g>
  );
}
