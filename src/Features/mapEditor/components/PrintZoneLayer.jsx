import { useRef } from "react";

import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import {
  getPrintZoneAspect,
  resizePrintZoneKeepingCenter,
} from "Features/baseMaps/utils/printZone";

// « Zone d'impression » of the main base map: light grey dashed sheet
// rect in the base map reference frame (same group as the annotations).
//
// - Fonds de plan + Dessin modules. In Dessin the base map name sits at the
//   bottom-left of the sheet; clicking it (or the dashed frame) selects the
//   base map (right panel → PanelBaseMapProperties, where the zone fields
//   live).
// - The user positions the IMAGE on the sheet, not the sheet: the sheet is
//   the world reference frame (MainMapEditorV3 poses the image at -zone.x /
//   -zone.y inside it), so a MOVE drag (frame stroke, or the image itself
//   once the base map is explicitly selected) moves the zone rect by -d in
//   image px: the sheet stays still on screen, the image slides. The live
//   rect is owned by MainMapEditorV3 (onDraftChange) and folded into the
//   pose in the same render — camera untouched, no jitter.
// - Free scale: corner handles resize the sheet around its centre, keeping
//   its aspect.
// - Self-contained gesture (PhotoPlanGuideLinesLayer pattern): pointer
//   capture + preventDefault on pointerdown, so the editor's mousedown
//   pipeline (pan / draw / clearSelection) never sees it. ONE db write on
//   pointerup through onCommit.
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

export default function PrintZoneLayer({
  baseMap,
  basePose,
  zone, // effective rect (draft during a drag, else the resolved zone)
  isSelected,
  explicitlySelected,
  interactive,
  showName,
  onSelect,
  onDeselect,
  onDraftChange,
  onCommit,
}) {
  // state

  const gRef = useRef(null);
  // { handleType, startClient, startScale, startZone, active, lastDraft }
  const dragRef = useRef(null);

  // data

  const printZone = baseMap?.getPrintZone?.() ?? null;
  const imageSize = baseMap?.getImageSize?.();
  const sizeLocked = printZone?.scale > 0 && baseMap?.getMeterByPx?.() > 0;

  if (!zone || !basePose) return null;

  const { x, y, width, height } = zone;
  const k = basePose.k || 1;
  const nameS = getBaseMapDisplayName(baseMap).label;

  // helpers

  // Screen px per image px at drag start (camera pans during a MOVE drag
  // change the CTM offset, never its scale).
  const getScreenScale = () => gRef.current?.getScreenCTM?.()?.a || 1;

  // Corner resize around the sheet centre (the centre is the world origin,
  // see MainMapEditorV3): the image stays still, both opposite corners move.
  const resizeFromCorner = (startZone, handleType, d) => {
    const ratio = getPrintZoneAspect(startZone.format, startZone.orientation);
    const east = handleType === "NE" || handleType === "SE";
    const newW = Math.max(
      MIN_WIDTH_PX,
      startZone.width + 2 * (east ? d.x : -d.x)
    );
    return resizePrintZoneKeepingCenter(startZone, {
      width: newW,
      height: newW / ratio,
    });
  };

  // handlers

  const handlePointerDown = (e) => {
    const el = e.target?.closest?.('[data-interaction="transform-print-zone"]');
    if (!el || !interactive) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      handleType: el.getAttribute("data-handle-type"),
      startClient: { x: e.clientX, y: e.clientY },
      startScale: getScreenScale(),
      startZone: zone,
      active: false,
      lastDraft: null,
    };
    gRef.current?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    const D = {
      x: e.clientX - drag.startClient.x,
      y: e.clientY - drag.startClient.y,
    };
    if (!drag.active) {
      const canDrag =
        isSelected &&
        drag.handleType !== "SELECT" &&
        drag.handleType !== "IMAGE_CLICK";
      const moved =
        Math.abs(D.x) > DRAG_THRESHOLD_PX || Math.abs(D.y) > DRAG_THRESHOLD_PX;
      if (!canDrag || !moved) return;
      drag.active = true;
    }
    const d = { x: D.x / drag.startScale, y: D.y / drag.startScale };
    let next = null;
    if (drag.handleType === "MOVE") {
      // Image slides under a still sheet: zone -d (the pose follows).
      next = {
        ...drag.startZone,
        x: drag.startZone.x - d.x,
        y: drag.startZone.y - d.y,
      };
    } else if (!sizeLocked) {
      next = resizeFromCorner(drag.startZone, drag.handleType, d);
    }
    if (next) {
      drag.lastDraft = next;
      onDraftChange?.(next);
    }
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    dragRef.current = null;
    gRef.current?.releasePointerCapture?.(e.pointerId);
    if (e.type === "pointercancel") {
      onDraftChange?.(null);
      return;
    }
    if (!drag.active) {
      if (drag.handleType === "IMAGE_CLICK") onDeselect?.();
      else onSelect?.();
      return;
    }
    // The draft stays until the liveQuery re-emits the record (owner side).
    if (drag.lastDraft) onCommit?.({ ...printZone, ...drag.lastDraft });
  };

  // render

  const showHandles = isSelected && interactive && !sizeLocked;
  const showImageGrab =
    explicitlySelected && interactive && imageSize?.width > 0;
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
      {/* 0. image grab area (explicit selection): drag the image itself */}
      {showImageGrab && (
        <rect
          x={0}
          y={0}
          width={imageSize.width}
          height={imageSize.height}
          fill="transparent"
          style={{ pointerEvents: "all", cursor: "move" }}
          data-interaction="transform-print-zone"
          data-handle-type="MOVE"
          data-image-grab="true"
        />
      )}

      {/* 1. dashed sheet frame (never interactive) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={STROKE}
        strokeWidth={isSelected ? 1 : 0.75}
        strokeDasharray="4 3"
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
