import { useCallback, useRef } from "react";

import computeResizedRect from "../utils/computeResizedRect";

import theme from "Styles/theme";

const HANDLE_SIZE = 8;

// Only move + horizontal resize (e, w) — height is auto-computed by legend content
const HANDLES = [
  {
    id: "e",
    xFn: (r) => r.x + r.width,
    yFn: (r) => r.y + r.height / 2,
    cursor: "ew-resize",
  },
  {
    id: "w",
    xFn: (r) => r.x,
    yFn: (r) => r.y + r.height / 2,
    cursor: "ew-resize",
  },
];

export default function LegendTransformOverlay({
  rect, // { x, y, width, height }
  zoom = 1,
  onCommit, // ({ x, y, width }) => void
  legendRef, // ref to the foreignObject element for live visual updates
}) {
  // refs — all transient drag state, zero re-renders during drag

  const rectRef = useRef(null);
  const startRectRef = useRef(null);
  const startPointRef = useRef(null);
  const activeHandleRef = useRef(null);

  const borderRef = useRef(null);
  const moveRef = useRef(null);
  const handleRefsMap = useRef({});

  // helpers

  const compensatedSize = HANDLE_SIZE / zoom;
  const half = compensatedSize / 2;
  const strokeW = 2 / zoom;

  function getSvgPoint(e) {
    const svg = e.target.closest("svg[data-portfolio-page-id]");
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function applyRect() {
    const r = rectRef.current;
    if (!r) return;

    if (borderRef.current) {
      borderRef.current.setAttribute("x", r.x);
      borderRef.current.setAttribute("y", r.y);
      borderRef.current.setAttribute("width", r.width);
      borderRef.current.setAttribute("height", r.height);
    }

    if (moveRef.current) {
      moveRef.current.setAttribute("x", r.x);
      moveRef.current.setAttribute("y", r.y);
      moveRef.current.setAttribute("width", r.width);
      moveRef.current.setAttribute("height", r.height);
    }

    for (const h of HANDLES) {
      const el = handleRefsMap.current[h.id];
      if (el) {
        el.setAttribute("x", h.xFn(r) - half);
        el.setAttribute("y", h.yFn(r) - half);
      }
    }

    // live visual update of the legend foreignObject
    const fo = legendRef?.current?.querySelector("foreignObject");
    if (fo) {
      fo.setAttribute("x", r.x);
      fo.setAttribute("y", r.y);
      fo.setAttribute("width", r.width);
    }
  }

  // handlers

  const handlePointerDown = useCallback(
    (handle) => (e) => {
      e.stopPropagation();
      e.preventDefault();
      const pt = getSvgPoint(e);
      if (!pt) return;

      startRectRef.current = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      rectRef.current = { ...startRectRef.current };
      startPointRef.current = pt;
      activeHandleRef.current = handle;

      e.target.setPointerCapture(e.pointerId);
    },
    [rect.x, rect.y, rect.width, rect.height]
  );

  const handlePointerMove = useCallback((e) => {
    if (!activeHandleRef.current) return;
    e.stopPropagation();

    const pt = getSvgPoint(e);
    if (!pt || !startPointRef.current) return;

    const dx = pt.x - startPointRef.current.x;
    const dy = pt.y - startPointRef.current.y;

    rectRef.current = computeResizedRect(
      startRectRef.current,
      dx,
      dy,
      activeHandleRef.current,
      null // no aspect ratio lock
    );

    applyRect();
  }, []);

  const handlePointerUp = useCallback(
    (e) => {
      if (!activeHandleRef.current) return;
      e.stopPropagation();

      const r = rectRef.current;
      if (r && onCommit) {
        onCommit({ x: r.x, y: r.y, width: r.width });
      }

      activeHandleRef.current = null;
      startRectRef.current = null;
      startPointRef.current = null;
      rectRef.current = null;
    },
    [onCommit]
  );

  // render

  return (
    <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {/* selection border */}
      <rect
        ref={borderRef}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        stroke={theme.palette.viewers.portfolio}
        strokeWidth={strokeW}
        pointerEvents="none"
      />

      {/* move area */}
      <rect
        ref={moveRef}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="transparent"
        style={{ cursor: "move" }}
        onPointerDown={handlePointerDown("move")}
      />

      {/* resize handles */}
      {HANDLES.map((h) => (
        <rect
          key={h.id}
          ref={(el) => {
            handleRefsMap.current[h.id] = el;
          }}
          x={h.xFn(rect) - half}
          y={h.yFn(rect) - half}
          width={compensatedSize}
          height={compensatedSize}
          fill="white"
          stroke={theme.palette.viewers.portfolio}
          strokeWidth={strokeW}
          style={{ cursor: h.cursor }}
          onPointerDown={handlePointerDown(h.id)}
        />
      ))}
    </g>
  );
}
