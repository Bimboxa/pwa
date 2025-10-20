import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";

import { grey } from "@mui/material/colors";

import useIsMobile from "Features/layout/hooks/useIsMobile";

/**
 * Draggable SVG marker:
 * - marker: { id, x, y, iconKey, fillColor, listingId, entity? }
 * - spriteImage: { iconKeys, columns, rows, tile, url }
 * - imageSize: { w, h }
 * - containerK: number
 * - worldScale: number
 * - onDragEnd({id, x, y})
 * - onClick(marker)
 * - selected: boolean
 */
export default function NodeMarker({
  marker,
  spriteImage,
  imageSize,
  containerK,
  worldScale,
  onDragStart,
  onDragEnd,
  onClick,
  selected,
}) {
  const dataProps = {
    "data-node-id": marker.id,
    "data-node-listing-id": marker.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "MARKER",
  };

  // is mobile

  const isMobile = useIsMobile();

  // Test has images

  const hasImages = marker.hasImages;

  // Label text
  const labelText = (marker?.entity?.num ?? "").toString();
  const showLabel = Boolean(labelText);

  const [hide] = useState(false);
  const draggingEnabled = selected;

  // Sprite
  const {
    iconKeys,
    columns,
    rows,
    tile,
    url: spriteSheetUrl,
  } = spriteImage ?? {};

  const resolvedIndex = Math.max(0, iconKeys?.indexOf(marker?.iconKey) ?? 0);
  const row = Math.floor(resolvedIndex / (columns || 1));
  const col = columns ? resolvedIndex % columns : 0;
  const sheetW = (columns || 1) * (tile || 0);
  const sheetH = (rows || 1) * (tile || 0);

  // Screen-constant sizing helpers
  const F = useMemo(
    () => (worldScale || 1) * (containerK || 1),
    [worldScale, containerK]
  );
  const invF = 1 / F;
  const localScale = isMobile ? invF : 1;

  const circleDiameterPx = 32 * localScale;
  const iconSizePx = 32 * localScale;
  const hitStrokePx = 24 * localScale;

  const rLocal = circleDiameterPx / 2;
  const iconLocal = iconSizePx;
  const hitStrokeLocal = Math.max(
    hitStrokePx * (isMobile ? 1 : invF),
    8 * (isMobile ? 1 : invF)
  );

  const fillColor = marker?.fillColor ?? "#f44336";

  // Position
  const pixelX = (marker.x || 0) * (imageSize?.w || 0);
  const pixelY = (marker.y || 0) * (imageSize?.h || 0);

  const CLICK_DRAG_TOL = 5;
  const movedRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetScreen, setDragOffsetScreen] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Reset dragOffsetScreen
  useLayoutEffect(() => {
    console.log("newMarker");
    setDragOffsetScreen({ x: 0, y: 0 });
  }, [marker]);

  const offsetBgX = dragOffsetScreen.x * invF;
  const offsetBgY = dragOffsetScreen.y * invF;

  const currentX = pixelX + offsetBgX;
  const currentY = pixelY + offsetBgY;

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!draggingEnabled) return;
      setIsDragging(true);
      onDragStart?.(); // Notify parent that dragging started
      movedRef.current = false;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        px: pixelX,
        py: pixelY,
      };
      setDragOffsetScreen({ x: 0, y: 0 });
    },
    [pixelX, pixelY, draggingEnabled, onDragStart]
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
        //setDragOffsetScreen({ x: 0, y: 0 });
        return;
      }

      const dxBg = dx * invF;
      const dyBg = dy * invF;

      const newPx = dragStartRef.current.px + dxBg;
      const newPy = dragStartRef.current.py + dyBg;

      const newRatioX = Math.max(0, Math.min(1, newPx / (imageSize?.w || 1)));
      const newRatioY = Math.max(0, Math.min(1, newPy / (imageSize?.h || 1)));

      onDragEnd?.({ id: marker.id, x: newRatioX, y: newRatioY });
      //setDragOffsetScreen({ x: 0, y: 0 });
    },
    [invF, imageSize?.w, imageSize?.h, onDragEnd, onClick, marker]
  );

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

  /* ---------- Label measurement & layout ---------- */
  const textRef = useRef(null);
  const [labelSize, setLabelSize] = useState({ w: 0, h: 0 });

  const labelFontPx = 11 * localScale;
  const labelPad = 4 * localScale; // padding inside white rect
  const gap = -2 * localScale; // stick distance from circle (px) at bottom-right

  useLayoutEffect(() => {
    if (!showLabel || !textRef.current) {
      setLabelSize({ w: 0, h: 0 });
      return;
    }
    try {
      const bb = textRef.current.getBBox();
      setLabelSize({ w: Math.ceil(bb.width), h: Math.ceil(bb.height) });
    } catch {
      const approxW = labelText.length * (labelFontPx * 0.6);
      setLabelSize({ w: Math.ceil(approxW), h: Math.ceil(labelFontPx * 1.2) });
    }
  }, [showLabel, labelText, labelFontPx, worldScale, containerK, selected]);

  const rectW = labelSize.w + labelPad * 2;
  const rectH = Math.max(labelSize.h, Math.ceil(labelFontPx * 1.2));

  // 🔴 Anchor rule:
  // Top-left corner of the label is stuck to the circle's BOTTOM-RIGHT side (bounding box),
  // with a tiny gap of 2px outward.
  const rectX = rLocal * 0.5 + gap; // to the right of the circle
  const rectY = rLocal * 0.5 + gap; // below the circle

  return (
    <g
      transform={`translate(${currentX}, ${currentY})`}
      onPointerDown={handlePointerDown}
      style={{
        visibility: hide ? "hidden" : "visible",
        cursor: isDragging ? "grabbing" : "pointer",
        pointerEvents: "auto",
        filter: selected ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "none",
      }}
      {...dataProps}
    >
      {/* Circle */}
      <circle
        cx={0}
        cy={0}
        r={selected ? rLocal * 1.2 : rLocal}
        fill={fillColor}
        stroke="#fff"
        strokeWidth={2 * localScale}
        opacity={0.9}
        vectorEffect="non-scaling-stroke"
      />

      {/* Sprite icon */}
      {spriteSheetUrl && (
        <svg
          x={-iconLocal / 2}
          y={-iconLocal / 2}
          width={iconLocal}
          height={iconLocal}
          viewBox={`${(col || 0) * (tile || 0)} ${(row || 0) * (tile || 0)} ${
            tile || 0
          } ${tile || 0}`}
          style={{ pointerEvents: "none" }}
        >
          <image
            href={spriteSheetUrl}
            width={sheetW}
            height={sheetH}
            preserveAspectRatio="none"
          />
        </svg>
      )}

      {/* Wide hit ring */}
      <circle
        cx={0}
        cy={0}
        r={rLocal}
        fill="transparent"
        stroke="transparent"
        strokeWidth={hitStrokeLocal}
        pointerEvents="stroke"
      />

      {/* Label: top-left stuck to circle's bottom-right, text vertically centered */}
      {showLabel && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={rectX}
            y={rectY}
            rx={4 * localScale}
            ry={4 * localScale}
            width={rectW}
            height={rectH}
            fill="#fff"
            stroke={hasImages ? fillColor : grey[600]}
            strokeWidth={1 * localScale}
          />
          <text
            ref={textRef}
            x={rectX + labelPad}
            y={rectY + rectH / 2}
            dominantBaseline="middle"
            fontSize={labelFontPx}
            fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
            fill={hasImages ? "#111" : grey[600]}
            fontWeight="600"
          >
            {labelText}
          </text>
        </g>
      )}
    </g>
  );
}
