import { useCallback, useRef } from "react";

import db from "App/db/db";

import computeResizedRect from "../utils/computeResizedRect";

import theme from "Styles/theme";

const HANDLE_SIZE = 8;

const HANDLES = [
  { id: "nw", xFn: (r) => r.x, yFn: (r) => r.y, cursor: "nwse-resize" },
  {
    id: "n",
    xFn: (r) => r.x + r.width / 2,
    yFn: (r) => r.y,
    cursor: "ns-resize",
  },
  {
    id: "ne",
    xFn: (r) => r.x + r.width,
    yFn: (r) => r.y,
    cursor: "nesw-resize",
  },
  {
    id: "e",
    xFn: (r) => r.x + r.width,
    yFn: (r) => r.y + r.height / 2,
    cursor: "ew-resize",
  },
  {
    id: "se",
    xFn: (r) => r.x + r.width,
    yFn: (r) => r.y + r.height,
    cursor: "nwse-resize",
  },
  {
    id: "s",
    xFn: (r) => r.x + r.width / 2,
    yFn: (r) => r.y + r.height,
    cursor: "ns-resize",
  },
  {
    id: "sw",
    xFn: (r) => r.x,
    yFn: (r) => r.y + r.height,
    cursor: "nesw-resize",
  },
  {
    id: "w",
    xFn: (r) => r.x,
    yFn: (r) => r.y + r.height / 2,
    cursor: "ew-resize",
  },
];

export default function ContainerTransformOverlay({
  container,
  zoom = 1,
  innerSvgRef,
  framing = false,
}) {
  // refs — all transient drag state, zero re-renders during drag

  const rectRef = useRef(null);
  const startRectRef = useRef(null);
  const startViewBoxRef = useRef(null);
  const startPointRef = useRef(null);
  const activeHandleRef = useRef(null);

  const borderRef = useRef(null);
  const moveRef = useRef(null);
  const handleRefsMap = useRef({});
  const framingRef = useRef(framing);
  framingRef.current = framing;

  // helpers

  const compensatedSize = HANDLE_SIZE / zoom;
  const half = compensatedSize / 2;
  const strokeW = 2 / zoom;
  const aspectRatio = framing
    ? null
    : container.viewBox
      ? container.viewBox.width / container.viewBox.height
      : null;
  const aspectRatioRef = useRef(aspectRatio);
  aspectRatioRef.current = aspectRatio;

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

    // update selection border
    if (borderRef.current) {
      borderRef.current.setAttribute("x", r.x);
      borderRef.current.setAttribute("y", r.y);
      borderRef.current.setAttribute("width", r.width);
      borderRef.current.setAttribute("height", r.height);
    }

    // update move area
    if (moveRef.current) {
      moveRef.current.setAttribute("x", r.x);
      moveRef.current.setAttribute("y", r.y);
      moveRef.current.setAttribute("width", r.width);
      moveRef.current.setAttribute("height", r.height);
    }

    // update handles
    for (const h of HANDLES) {
      const el = handleRefsMap.current[h.id];
      if (el) {
        el.setAttribute("x", h.xFn(r) - half);
        el.setAttribute("y", h.yFn(r) - half);
      }
    }

    // update inner SVG
    if (innerSvgRef?.current) {
      innerSvgRef.current.setAttribute("x", r.x);
      innerSvgRef.current.setAttribute("y", r.y);
      innerSvgRef.current.setAttribute("width", r.width);
      innerSvgRef.current.setAttribute("height", r.height);

      // during framing, also adjust viewBox so the baseMap stays at same scale/position
      if (framingRef.current && startViewBoxRef.current && startRectRef.current) {
        const old = startRectRef.current;
        const vb = startViewBoxRef.current;
        const scaleX = vb.width / old.width;
        const scaleY = vb.height / old.height;
        const newVB = {
          x: vb.x + (r.x - old.x) * scaleX,
          y: vb.y + (r.y - old.y) * scaleY,
          width: vb.width * (r.width / old.width),
          height: vb.height * (r.height / old.height),
        };
        innerSvgRef.current.setAttribute(
          "viewBox",
          `${newVB.x} ${newVB.y} ${newVB.width} ${newVB.height}`
        );
      }
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
        x: container.x,
        y: container.y,
        width: container.width,
        height: container.height,
      };
      if (framingRef.current && innerSvgRef?.current) {
        const vb = innerSvgRef.current.viewBox.baseVal;
        startViewBoxRef.current = {
          x: vb.x,
          y: vb.y,
          width: vb.width,
          height: vb.height,
        };
      }
      rectRef.current = { ...startRectRef.current };
      startPointRef.current = pt;
      activeHandleRef.current = handle;

      e.target.setPointerCapture(e.pointerId);
    },
    [container.x, container.y, container.width, container.height]
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
      aspectRatioRef.current
    );

    applyRect();
  }, []);

  const handlePointerUp = useCallback(
    (e) => {
      if (!activeHandleRef.current) return;
      e.stopPropagation();

      const r = rectRef.current;
      if (r) {
        const update = { x: r.x, y: r.y, width: r.width, height: r.height };

        // When framing, persist the adjusted viewBox
        if (framingRef.current && startViewBoxRef.current && startRectRef.current) {
          const old = startRectRef.current;
          const vb = startViewBoxRef.current;
          const scaleX = vb.width / old.width;
          const scaleY = vb.height / old.height;
          update.viewBox = {
            x: vb.x + (r.x - old.x) * scaleX,
            y: vb.y + (r.y - old.y) * scaleY,
            width: vb.width * (r.width / old.width),
            height: vb.height * (r.height / old.height),
          };
        }

        db.portfolioBaseMapContainers.update(container.id, update);
      }

      activeHandleRef.current = null;
      startRectRef.current = null;
      startViewBoxRef.current = null;
      startPointRef.current = null;
      rectRef.current = null;
    },
    [container.id]
  );

  // render

  const r = {
    x: container.x,
    y: container.y,
    width: container.width,
    height: container.height,
  };
  const strokeColor = framing
    ? theme.palette.primary.main
    : theme.palette.viewers.portfolio;

  return (
    <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {/* selection border */}
      <rect
        ref={borderRef}
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        pointerEvents="none"
      />

      {/* move area — hidden during framing (pan handled by FramingOverlay) */}
      {!framing && (
        <rect
          ref={moveRef}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="transparent"
          style={{ cursor: "move" }}
          onPointerDown={handlePointerDown("move")}
        />
      )}

      {/* 8 resize handles */}
      {HANDLES.map((h) => (
        <rect
          key={h.id}
          ref={(el) => {
            handleRefsMap.current[h.id] = el;
          }}
          x={h.xFn(r) - half}
          y={h.yFn(r) - half}
          width={compensatedSize}
          height={compensatedSize}
          fill="white"
          stroke={strokeColor}
          strokeWidth={strokeW}
          style={{ cursor: h.cursor }}
          onPointerDown={handlePointerDown(h.id)}
        />
      ))}
    </g>
  );
}
