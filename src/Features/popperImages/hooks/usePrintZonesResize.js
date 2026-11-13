import { useEffect, useRef, useState } from "react";

import { PRINT_ZONE_SIDES } from "../utils/layoutImagePrintZones";
import { PRINT_ZONES_TILE_SIZE_MIN_PX } from "../services/popperImagesLocalStorage";

// ---------------------------------------------------------------------------
// usePrintZonesResize — hover + resize of the photos "print zones", shared by
// the editors (ImagesPrintZonesOverlay, html) and the capture frame
// (CaptureImagePrintZonesOverlay, svg).
//
// `zones` / `rect`: the layout of useImagePrintZonesLayout, px relative to
// the origin `getOriginRect()` gives in client px. The hover is read from
// window mousemove, so the host never has to take the mouse from the editor:
// the occupied zone under the pointer (none while a mouse button is down).
// `onPatch(side, patch)` receives { thickness } | { startInset } |
// { endInset } while a handle is dragged.
//
// Returns { side, outline, handles, resizing, getHandleProps }:
// - outline: { x, y, width, height } of the dashed frame to draw, or null;
// - handles: [{ kind, x, y, width, height, cursor }] (top-left based):
//   THICKNESS on the inner edge, START / END on the two ends;
// - getHandleProps(kind): pointer handlers of a handle element.
// ---------------------------------------------------------------------------

// Outline: drawn this far around the zone, hovered this far around it.
const OUTLINE_MARGIN_PX = 4;
const HOVER_MARGIN_PX = 12;
const HANDLE_LENGTH_PX = 28;
const HANDLE_THICKNESS_PX = 8;
// Inward direction of each zone, as a factor of the pointer (dx, dy).
const INWARD = {
  TOP: { x: 0, y: 1 },
  BOTTOM: { x: 0, y: -1 },
  LEFT: { x: 1, y: 0 },
  RIGHT: { x: -1, y: 0 },
};

function isHorizontalSide(side) {
  return side === "TOP" || side === "BOTTOM";
}

// Centre point of the 3 handles of an outline + whether the bar lies flat.
function getHandleAnchors(side, o) {
  const cx = o.x + o.width / 2;
  const cy = o.y + o.height / 2;
  if (isHorizontalSide(side)) {
    return [
      {
        kind: "THICKNESS",
        x: cx,
        y: side === "TOP" ? o.y + o.height : o.y,
        flat: true,
      },
      { kind: "START", x: o.x, y: cy, flat: false },
      { kind: "END", x: o.x + o.width, y: cy, flat: false },
    ];
  }
  return [
    {
      kind: "THICKNESS",
      x: side === "LEFT" ? o.x + o.width : o.x,
      y: cy,
      flat: false,
    },
    { kind: "START", x: cx, y: o.y, flat: true },
    { kind: "END", x: cx, y: o.y + o.height, flat: true },
  ];
}

export default function usePrintZonesResize({
  active,
  zones,
  rect,
  getOriginRect,
  onPatch,
}) {
  // state

  const [hoveredSide, setHoveredSide] = useState(null);
  const [resizingSide, setResizingSide] = useState(null);
  const dragRef = useRef(null);

  // effects

  useEffect(() => {
    if (!active) return undefined;
    const onMove = (e) => {
      if (dragRef.current || e.buttons) return;
      const o = getOriginRect?.();
      if (!o) return;
      const x = e.clientX - o.left;
      const y = e.clientY - o.top;
      const m = HOVER_MARGIN_PX;
      const side =
        PRINT_ZONE_SIDES.find((s) => {
          const z = zones?.[s];
          return (
            z?.count > 0 &&
            x >= z.x - m &&
            x <= z.x + z.width + m &&
            y >= z.y - m &&
            y <= z.y + z.height + m
          );
        }) ?? null;
      setHoveredSide((prev) => (prev === side ? prev : side));
    };
    const onLeave = () => {
      if (!dragRef.current) setHoveredSide(null);
    };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [active, zones, getOriginRect]);

  // helpers

  const side = active ? (resizingSide ?? hoveredSide) : null;
  const zone = side ? zones?.[side] : null;
  const outline = zone
    ? {
        x: zone.x - OUTLINE_MARGIN_PX,
        y: zone.y - OUTLINE_MARGIN_PX,
        width: zone.width + 2 * OUTLINE_MARGIN_PX,
        height: zone.height + 2 * OUTLINE_MARGIN_PX,
      }
    : null;
  const handles = outline
    ? getHandleAnchors(side, outline).map((h) => {
        const width = h.flat ? HANDLE_LENGTH_PX : HANDLE_THICKNESS_PX;
        const height = h.flat ? HANDLE_THICKNESS_PX : HANDLE_LENGTH_PX;
        return {
          kind: h.kind,
          x: h.x - width / 2,
          y: h.y - height / 2,
          width,
          height,
          cursor: h.flat ? "ns-resize" : "ew-resize",
        };
      })
    : [];

  // handlers

  function handlePointerDown(e, kind) {
    if (!zone || !rect) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const horizontal = isHorizontalSide(side);
    const rectStart = horizontal ? rect.x : rect.y;
    const rectLength = horizontal ? rect.width : rect.height;
    const zoneStart = horizontal ? zone.x : zone.y;
    const zoneLength = horizontal ? zone.width : zone.height;
    dragRef.current = {
      side,
      kind,
      horizontal,
      x0: e.clientX,
      y0: e.clientY,
      thickness: horizontal ? zone.height : zone.width,
      startInset: zoneStart - rectStart,
      endInset: rectStart + rectLength - (zoneStart + zoneLength),
      rectLength,
    };
    setResizingSide(side);
  }

  function handlePointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const along = d.horizontal ? dx : dy;
    const maxInset = (other) =>
      Math.max(0, d.rectLength - other - PRINT_ZONES_TILE_SIZE_MIN_PX);
    const clampTo = (v, max) => Math.min(max, Math.max(0, v));
    let patch;
    if (d.kind === "THICKNESS") {
      const inward = INWARD[d.side];
      patch = { thickness: d.thickness + dx * inward.x + dy * inward.y };
    } else if (d.kind === "START") {
      patch = {
        startInset: clampTo(d.startInset + along, maxInset(d.endInset)),
      };
    } else {
      patch = {
        endInset: clampTo(d.endInset - along, maxInset(d.startInset)),
      };
    }
    onPatch?.(d.side, patch);
  }

  function handlePointerUp() {
    dragRef.current = null;
    setResizingSide(null);
  }

  const getHandleProps = (kind) => ({
    onPointerDown: (e) => handlePointerDown(e, kind),
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    // The capture frame / the editor must not start a drag of their own.
    onMouseDown: (e) => e.stopPropagation(),
  });

  return {
    side,
    outline,
    handles,
    resizing: Boolean(resizingSide),
    getHandleProps,
  };
}
