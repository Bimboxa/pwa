// Screen-space overlay rendered when image mode is on.
//
// - Dims the viewport outside the capture rectangle (4 grey rects).
// - Draws the capture rectangle outline.
// - Renders the legend (NodeLegendStatic) at a draggable/resizable
//   position INSIDE the rectangle, in pixel coords (zoom-independent).
//
// The legend body is the move target. A small SE-corner handle is the
// resize-width target. The dim mask and rect border are pointer-events:
// none so the user can still pan/zoom the map underneath.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setImageModeLegendOverlay } from "../mapEditorSlice";

import NodeLegendStatic from "Features/mapEditorGeneric/components/NodeLegendStatic";
import getCaptureRectBounds from "../utils/getCaptureRectBounds";

const DIM_FILL = "rgba(0,0,0,0.45)";
const RECT_STROKE = "rgba(255,255,255,0.95)";
const HANDLE_SIZE = 12;
const MIN_LEGEND_WIDTH = 120;
const MAX_LEGEND_WIDTH = 600;

export default function ImageModeOverlay({
  viewportWidth,
  viewportHeight,
  legendItems,
  spriteImage,
  qtiesById,
}) {
  const dispatch = useDispatch();

  // data

  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const overlay = useSelector((s) => s.mapEditor.imageModeLegendOverlay);
  const showWatermark = useSelector(
    (s) => s.mapEditor.imageModeShowWatermark
  );
  const watermarkUrl = useSelector(
    (s) =>
      s.appConfig.value?.features?.watermark?.urlsByAspectRatio?.[
        s.mapEditor.imageModeAspectRatio
      ] ?? null
  );
  const showLogo = useSelector((s) => s.mapEditor.imageModeShowLogo);
  const logoUrl = useSelector(
    (s) => s.appConfig.value?.features?.watermark?.logoUrl ?? null
  );

  // When the right panel is open it floats over the viewport without
  // shrinking it; center the capture rect within the visible zone.
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  const rect = getCaptureRectBounds(
    viewportWidth,
    viewportHeight,
    aspectRatio,
    { rightInset }
  );

  // Resolve x/y null → default top-right of the capture rect. As soon as
  // the user drags, x/y become numeric and stick.
  const DEFAULT_PADDING = 16;
  const resolvedX =
    overlay.x ?? Math.max(0, rect.width - overlay.width - DEFAULT_PADDING);
  const resolvedY = overlay.y ?? DEFAULT_PADDING;

  // measure legend height (provided by NodeLegendStatic)
  const [legendHeight, setLegendHeight] = useState(60);
  const handleLegendSizeChange = useCallback(({ height }) => {
    setLegendHeight((prev) =>
      Math.abs(prev - height) < 1 ? prev : Math.max(20, height)
    );
  }, []);

  // drag state (refs to keep mousemove listener identity stable)
  const dragRef = useRef(null); // { type: "MOVE" | "RESIZE", startX, startY, base }
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  // commit overlay updates (throttle via rAF for smoothness)
  const rafIdRef = useRef(null);
  const pendingOverlayRef = useRef(null);
  const commitOverlay = useCallback(
    (next) => {
      pendingOverlayRef.current = next;
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingOverlayRef.current) {
          dispatch(setImageModeLegendOverlay(pendingOverlayRef.current));
          pendingOverlayRef.current = null;
        }
      });
    },
    [dispatch]
  );

  // global mousemove / mouseup during a drag
  useEffect(() => {
    function handleMove(e) {
      if (!dragRef.current) return;
      const { type, startX, startY, base } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (type === "MOVE") {
        const maxX = Math.max(0, rect.width - base.width);
        const maxY = Math.max(0, rect.height - 20);
        commitOverlay({
          ...base,
          x: clamp(base.x + dx, 0, maxX),
          y: clamp(base.y + dy, 0, maxY),
        });
      } else if (type === "RESIZE") {
        const next = clamp(
          base.width + dx,
          MIN_LEGEND_WIDTH,
          Math.min(MAX_LEGEND_WIDTH, rect.width - base.x)
        );
        commitOverlay({ ...base, width: next });
      }
    }
    function handleUp() {
      dragRef.current = null;
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [commitOverlay, rect.width, rect.height]);

  function startMove(e) {
    e.preventDefault();
    e.stopPropagation();
    // Seed the drag with resolved pixel values so dragging from the
    // default (null) position works smoothly.
    dragRef.current = {
      type: "MOVE",
      startX: e.clientX,
      startY: e.clientY,
      base: { ...overlayRef.current, x: resolvedX, y: resolvedY },
    };
    document.body.style.cursor = "grabbing";
  }

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type: "RESIZE",
      startX: e.clientX,
      startY: e.clientY,
      base: { ...overlayRef.current, x: resolvedX, y: resolvedY },
    };
    document.body.style.cursor = "ew-resize";
  }

  // legend origin in viewport coords
  const legendX = rect.left + resolvedX;
  const legendY = rect.top + resolvedY;

  // render

  if (!viewportWidth || !viewportHeight) return null;

  return (
    <svg
      width={viewportWidth}
      height={viewportHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {/* DIM MASK + CAPTURE RECT BORDER (hidden during capture) */}
      <g data-capture-hide>
        <rect
          x={0}
          y={0}
          width={viewportWidth}
          height={Math.max(0, rect.top)}
          fill={DIM_FILL}
        />
        <rect
          x={0}
          y={rect.top + rect.height}
          width={viewportWidth}
          height={Math.max(0, viewportHeight - rect.top - rect.height)}
          fill={DIM_FILL}
        />
        <rect
          x={0}
          y={rect.top}
          width={Math.max(0, rect.left)}
          height={rect.height}
          fill={DIM_FILL}
        />
        <rect
          x={rect.left + rect.width}
          y={rect.top}
          width={Math.max(0, viewportWidth - rect.left - rect.width)}
          height={rect.height}
          fill={DIM_FILL}
        />
        <rect
          x={rect.left}
          y={rect.top}
          width={rect.width}
          height={rect.height}
          fill="none"
          stroke={RECT_STROKE}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </g>

      {/* WATERMARK (above the map, below the legend).
          The SVG asset is authored in mid-grey (stroke #888); opacity
          on the `<image>` softens it further. */}
      {showWatermark && watermarkUrl && (
        <image
          data-capture-keep
          href={watermarkUrl}
          x={rect.left}
          y={rect.top}
          width={rect.width}
          height={rect.height}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* LOGO (anchored bottom-right of the capture rect, 60px from bottom).
          Sized 200x50 (4:1 aspect). */}
      {showLogo && logoUrl && (() => {
        const LOGO_W = 200;
        const LOGO_H = 50;
        const BOTTOM_MARGIN = 60;
        const x = rect.left + rect.width - LOGO_W;
        const y = rect.top + rect.height - BOTTOM_MARGIN - LOGO_H;
        return (
          <image
            data-capture-keep
            href={logoUrl}
            x={x}
            y={y}
            width={LOGO_W}
            height={LOGO_H}
            preserveAspectRatio="xMaxYMax meet"
            style={{ pointerEvents: "none" }}
          />
        );
      })()}

      {/* LEGEND OVERLAY (inside the capture rect) */}
      {overlay.visible !== false && (
      <g
        data-capture-keep
        transform={`translate(${legendX}, ${legendY})`}
        onMouseDown={startMove}
        style={{ cursor: "grab" }}
      >
        {legendItems?.length > 0 ? (
          <NodeLegendStatic
            legendItems={legendItems}
            spriteImage={spriteImage}
            legendFormat={{
              x: 0,
              y: 0,
              width: overlay.width,
              fontSize: overlay.fontSize,
            }}
            showQty={overlay.showQty}
            qtiesById={qtiesById}
            onSizeChange={handleLegendSizeChange}
          />
        ) : (
          // Empty-state placeholder: keeps the drag target alive even when
          // there are no items to render yet (annotations still loading, no
          // visible annotations, etc.).
          <g data-capture-hide>
            <rect
              x={0}
              y={0}
              width={overlay.width}
              height={legendHeight}
              fill="rgba(255,255,255,0.85)"
              stroke="#2196f3"
              strokeWidth={1}
              strokeDasharray="3 3"
              rx={4}
              style={{ pointerEvents: "auto" }}
            />
            <foreignObject
              x={8}
              y={8}
              width={overlay.width - 16}
              height={legendHeight - 16}
            >
              <div
                style={{
                  font: "12px sans-serif",
                  color: "#666",
                  pointerEvents: "auto",
                }}
              >
                Légende vide
              </div>
            </foreignObject>
          </g>
        )}

        {/* SE resize handle (data-capture-hide) */}
        <g data-capture-hide>
          <rect
            x={overlay.width - HANDLE_SIZE / 2}
            y={legendHeight - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="#2196f3"
            stroke="white"
            strokeWidth={1}
            rx={2}
            style={{ cursor: "ew-resize", pointerEvents: "auto" }}
            onMouseDown={startResize}
          />
        </g>
      </g>
      )}
    </svg>
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
