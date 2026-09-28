import { useEffect, useRef, useState } from "react";

import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import { getPrintZoneAspect } from "Features/baseMaps/utils/printZone";

// « Zone d'impression » of the main base map: light grey dashed sheet
// rect in the base map reference frame (same group as the annotations).
//
// - Fonds de plan + Dessin modules. In Dessin the base map name sits at the
//   bottom-left of the zone; clicking it (or the dashed frame) selects the
//   base map (right panel → PanelBaseMapProperties, where the zone fields
//   live).
// - Selected: the frame is dragged (MOVE); when the size is not locked by a
//   1:N scale, the corner handles resize it keeping the sheet aspect.
// - Self-contained gesture (PhotoPlanGuideLinesLayer pattern): pointer
//   capture + preventDefault on pointerdown, so the editor's mousedown
//   pipeline (pan / draw / clearSelection) never sees it. Draft rect during
//   the drag, ONE db write on pointerup through onCommit.
// - data-capture-hide: never in the captured / exported images.

const STROKE = "#9e9e9e";
const HIT_BAND_PX = 8;
const HANDLE_SIZE_PX = 6;
const DRAG_THRESHOLD_PX = 3;
const MIN_WIDTH_PX = 50;
const HANDLES = [
  { type: "NW", cursor: "nw-resize" },
  { type: "NE", cursor: "ne-resize" },
  { type: "SE", cursor: "se-resize" },
  { type: "SW", cursor: "sw-resize" },
];

const sameRect = (a, b) =>
  a &&
  b &&
  Math.round(a.x) === Math.round(b.x) &&
  Math.round(a.y) === Math.round(b.y) &&
  Math.round(a.width) === Math.round(b.width) &&
  Math.round(a.height) === Math.round(b.height);

export default function PrintZoneLayer({
  baseMap,
  basePose,
  isSelected,
  interactive,
  showName,
  onSelect,
  onCommit,
}) {
  // state

  const [draft, setDraft] = useState(null);
  const gRef = useRef(null);
  const dragRef = useRef(null); // { handleType, startClient, startLocal, startZone, active, lastDraft }

  // data

  const printZone = baseMap?.getPrintZone?.() ?? null;
  const zone = draft ?? printZone;
  const sizeLocked = printZone?.scale > 0 && baseMap?.getMeterByPx?.() > 0;

  // Drop the draft when the persisted record caught up (or the map changed).
  useEffect(() => {
    if (draft && sameRect(draft, printZone)) setDraft(null);
  }, [draft, printZone]);
  useEffect(() => {
    setDraft(null);
  }, [baseMap?.id]);

  if (!zone || !basePose) return null;

  const { x, y, width, height } = zone;
  const k = basePose.k || 1;
  const nameS = getBaseMapDisplayName(baseMap).label;

  // helpers — coords via the group's CTM (camera + basePose folded in)

  const toLocal = (e) => {
    const ctm = gRef.current?.getScreenCTM?.();
    if (!ctm) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  };

  const resizeFromCorner = (startZone, handleType, d) => {
    const ratio = getPrintZoneAspect(startZone.format, startZone.orientation);
    const east = handleType === "NE" || handleType === "SE";
    const north = handleType === "NW" || handleType === "NE";
    const newW = Math.max(MIN_WIDTH_PX, startZone.width + (east ? d.x : -d.x));
    const newH = newW / ratio;
    return {
      ...startZone,
      x: east ? startZone.x : startZone.x + (startZone.width - newW),
      y: north ? startZone.y + (startZone.height - newH) : startZone.y,
      width: newW,
      height: newH,
    };
  };

  // handlers

  const handlePointerDown = (e) => {
    const el = e.target?.closest?.('[data-interaction="transform-print-zone"]');
    if (!el || !interactive) return;
    e.stopPropagation();
    e.preventDefault();
    const startLocal = toLocal(e);
    dragRef.current = {
      handleType: el.getAttribute("data-handle-type"),
      startClient: { x: e.clientX, y: e.clientY },
      startLocal,
      startZone: zone,
      active: false,
    };
    gRef.current?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    if (!drag.active) {
      const canDrag = isSelected && drag.handleType !== "SELECT";
      const moved =
        Math.abs(e.clientX - drag.startClient.x) > DRAG_THRESHOLD_PX ||
        Math.abs(e.clientY - drag.startClient.y) > DRAG_THRESHOLD_PX;
      if (!canDrag || !moved) return;
      drag.active = true;
    }
    const local = toLocal(e);
    if (!local || !drag.startLocal) return;
    const d = {
      x: local.x - drag.startLocal.x,
      y: local.y - drag.startLocal.y,
    };
    let next = null;
    if (drag.handleType === "MOVE") {
      next = {
        ...drag.startZone,
        x: drag.startZone.x + d.x,
        y: drag.startZone.y + d.y,
      };
    } else if (!sizeLocked) {
      next = resizeFromCorner(drag.startZone, drag.handleType, d);
    }
    if (next) {
      drag.lastDraft = next;
      setDraft(next);
    }
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    dragRef.current = null;
    gRef.current?.releasePointerCapture?.(e.pointerId);
    if (e.type === "pointercancel") {
      setDraft(null);
      return;
    }
    if (!drag.active) {
      onSelect?.();
      return;
    }
    // Draft kept until the liveQuery re-emits the record (effect above).
    if (drag.lastDraft) onCommit?.({ ...printZone, ...drag.lastDraft });
  };

  // render

  const showHandles = isSelected && interactive && !sizeLocked;
  const counterZoom = `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;

  return (
    <g
      data-capture-hide
      ref={gRef}
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${k})`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseDown={(e) => {
        // The editor's pan / draw listens on mousedown too.
        if (e.target?.closest?.('[data-interaction="transform-print-zone"]')) {
          e.stopPropagation();
        }
      }}
    >
      {/* 1. dashed sheet frame (never interactive) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={STROKE}
        strokeWidth={isSelected ? 2 : 1.5}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "none" }}
      />

      {/* 2. invisible hit band on the stroke */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_BAND_PX}
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: interactive ? "stroke" : "none",
          cursor: isSelected ? "move" : "pointer",
        }}
        data-interaction="transform-print-zone"
        data-handle-type="MOVE"
      />

      {/* 3. base map name (Dessin), bottom-left inside the sheet */}
      {showName && (
        <g transform={`translate(${x}, ${y + height})`}>
          <g style={{ transform: counterZoom }}>
            <text
              x={6}
              y={-6}
              fontSize={11}
              fill={STROKE}
              fontFamily="inherit"
              style={{
                pointerEvents: interactive ? "all" : "none",
                cursor: "pointer",
                userSelect: "none",
              }}
              data-interaction="transform-print-zone"
              data-handle-type="SELECT"
            >
              {nameS}
            </text>
          </g>
        </g>
      )}

      {/* 4. corner handles (selected, free size only) */}
      {showHandles &&
        HANDLES.map(({ type, cursor }) => {
          const hx = type === "NE" || type === "SE" ? x + width : x;
          const hy = type === "SE" || type === "SW" ? y + height : y;
          return (
            <g key={type} transform={`translate(${hx}, ${hy})`}>
              <g style={{ transform: counterZoom }}>
                <rect
                  x={-HANDLE_SIZE_PX / 2}
                  y={-HANDLE_SIZE_PX / 2}
                  width={HANDLE_SIZE_PX}
                  height={HANDLE_SIZE_PX}
                  fill="white"
                  stroke={STROKE}
                  strokeWidth={1}
                  style={{ cursor, pointerEvents: "auto" }}
                  data-interaction="transform-print-zone"
                  data-handle-type={type}
                />
              </g>
            </g>
          );
        })}
    </g>
  );
}
