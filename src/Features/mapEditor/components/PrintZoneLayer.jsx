import { useRef } from "react";

import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";

// « Zone d'impression » of the main base map: light grey dashed sheet
// rect in the base map reference frame (same group as the annotations),
// rendered OUTSIDE the world group MainMapEditorV3 transforms during a drag.
//
// - Fonds de plan + Dessin modules. In Dessin the base map name sits at the
//   bottom-left of the sheet; clicking it (or the dashed frame) selects the
//   base map (right panel → PanelBaseMapProperties, where the zone fields
//   live).
// - The user positions the IMAGE on the sheet, not the sheet. The sheet
//   centre is the world origin (see MainMapEditorV3), so:
//   MOVE (frame stroke, or the image itself once explicitly selected) →
//   live `translate` of the world group, zone rect -d in image px on
//   commit; RESIZE (corner handles of the IMAGE frame) → live `scale`
//   about the opposite image corner, zone rect scaled inversely on commit.
//   Nothing re-renders during the gesture: the sheet never moves, and the
//   ONE db write on pointerup is what moves the React tree (MainMapEditorV3
//   clears the live transform + compensates the camera in the same commit).
// - Self-contained gesture (PhotoPlanGuideLinesLayer pattern): pointer
//   capture + preventDefault on pointerdown, so the editor's mousedown
//   pipeline (pan / draw / clearSelection) never sees it.
// - data-capture-hide: never in the captured / exported images.

const STROKE = "#9e9e9e";
const IMAGE_FRAME_STROKE = "#2196f3";
const HIT_BAND_PX = 8;
const HANDLE_SIZE_PX = 7;
const DRAG_THRESHOLD_PX = 3;
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const HANDLES = [
  { type: "NW", cursor: "nw-resize", ax: 1, ay: 1 }, // anchor = opposite corner
  { type: "NE", cursor: "ne-resize", ax: 0, ay: 1 },
  { type: "SE", cursor: "se-resize", ax: 0, ay: 0 },
  { type: "SW", cursor: "sw-resize", ax: 1, ay: 0 },
];

export default function PrintZoneLayer({
  baseMap,
  basePose,
  isSelected,
  explicitlySelected,
  interactive,
  showName,
  onSelect,
  onDeselect,
  onLiveTransform,
  onCommit,
}) {
  // state

  const gRef = useRef(null);
  // { handleType: MOVE | IMAGE | SELECT | NW.., startClient,
  //   startScreenScale, startZone, anchorImg, handleImg, active, nextZone }
  const dragRef = useRef(null);

  // data

  const zone = baseMap?.getPrintZone?.() ?? null;
  const imageSize = baseMap?.getImageSize?.();
  const sizeLocked = zone?.scale > 0 && baseMap?.getMeterByPx?.() > 0;

  if (!zone || !basePose) return null;

  const { x, y, width, height } = zone;
  const k = basePose.k || 1;
  const nameS = getBaseMapDisplayName(baseMap).label;
  const W = imageSize?.width || 0;
  const H = imageSize?.height || 0;

  // helpers

  // Screen px per image px (the camera is never moved during a gesture).
  const getScreenScale = () => gRef.current?.getScreenCTM?.()?.a || 1;
  const imgToWorld = (p) => ({
    x: basePose.x + p.x * k,
    y: basePose.y + p.y * k,
  });

  // handlers

  const handlePointerDown = (e) => {
    const el = e.target?.closest?.('[data-interaction="transform-print-zone"]');
    if (!el || !interactive) return;
    e.stopPropagation();
    e.preventDefault();
    const handleType = el.getAttribute("data-handle-type");
    const handle = HANDLES.find((h) => h.type === handleType);
    dragRef.current = {
      handleType,
      startClient: { x: e.clientX, y: e.clientY },
      startScreenScale: getScreenScale(),
      startZone: zone,
      anchorImg: handle ? { x: handle.ax * W, y: handle.ay * H } : null,
      handleImg: handle
        ? { x: (1 - handle.ax) * W, y: (1 - handle.ay) * H }
        : null,
      active: false,
      nextZone: null,
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
      const canDrag = isSelected && drag.handleType !== "SELECT";
      const moved =
        Math.abs(D.x) > DRAG_THRESHOLD_PX || Math.abs(D.y) > DRAG_THRESHOLD_PX;
      if (!canDrag || !moved) return;
      drag.active = true;
    }
    // Screen → image px (gesture start scale: camera + basePose, constant).
    const d = {
      x: D.x / drag.startScreenScale,
      y: D.y / drag.startScreenScale,
    };
    const z = drag.startZone;

    // IMAGE = grab on the image itself (explicit selection): same MOVE
    // drag, but a plain click on it deselects.
    if (drag.handleType === "MOVE" || drag.handleType === "IMAGE") {
      // Image slides by d under a still sheet.
      drag.nextZone = { ...z, x: z.x - d.x, y: z.y - d.y };
      onLiveTransform?.(`translate(${d.x * k}, ${d.y * k})`);
      return;
    }

    if (!drag.anchorImg || sizeLocked) return;
    // Image scaled by s about the opposite corner A: the handle follows the
    // cursor along the A → handle diagonal.
    const A = drag.anchorImg;
    const Hd = drag.handleImg;
    const vx = Hd.x - A.x;
    const vy = Hd.y - A.y;
    const cx = Hd.x + d.x - A.x;
    const cy = Hd.y + d.y - A.y;
    const len2 = vx * vx + vy * vy || 1;
    const s = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, (cx * vx + cy * vy) / len2)
    );
    // Sheet in image px shrinks inversely about A.
    drag.nextZone = {
      ...z,
      x: A.x + (z.x - A.x) / s,
      y: A.y + (z.y - A.y) / s,
      width: z.width / s,
      height: z.height / s,
    };
    const Aw = imgToWorld(A);
    onLiveTransform?.(
      `translate(${Aw.x}, ${Aw.y}) scale(${s}) translate(${-Aw.x}, ${-Aw.y})`
    );
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    dragRef.current = null;
    gRef.current?.releasePointerCapture?.(e.pointerId);
    if (e.type === "pointercancel") {
      onLiveTransform?.(null);
      return;
    }
    if (!drag.active) {
      if (drag.handleType === "IMAGE") onDeselect?.();
      else onSelect?.();
      return;
    }
    // The live transform stays until the record re-emits (owner side).
    if (drag.nextZone) onCommit?.({ ...zone, ...drag.nextZone });
    else onLiveTransform?.(null);
  };

  // render

  const showImageFrame = explicitlySelected && interactive && W > 0 && H > 0;
  const showHandles = showImageFrame && !sizeLocked;
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
      {/* 0. image grab area + frame (explicit selection): drag the image */}
      {showImageFrame && (
        <>
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            style={{ pointerEvents: "all", cursor: "move" }}
            data-interaction="transform-print-zone"
            data-handle-type="IMAGE"
          />
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="none"
            stroke={IMAGE_FRAME_STROKE}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />
        </>
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

      {/* 2. invisible hit band on the sheet stroke */}
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

      {/* 4. image corner handles (explicit selection, free size only) */}
      {showHandles &&
        HANDLES.map(({ type, cursor, ax, ay }) => (
          <g
            key={type}
            transform={`translate(${(1 - ax) * W}, ${(1 - ay) * H})`}
          >
            <g style={{ transform: counterZoom }}>
              <rect
                x={-HANDLE_SIZE_PX / 2}
                y={-HANDLE_SIZE_PX / 2}
                width={HANDLE_SIZE_PX}
                height={HANDLE_SIZE_PX}
                fill="white"
                stroke={IMAGE_FRAME_STROKE}
                strokeWidth={1}
                style={{ cursor, pointerEvents: "auto" }}
                data-interaction="transform-print-zone"
                data-handle-type={type}
              />
            </g>
          </g>
        ))}
    </g>
  );
}
