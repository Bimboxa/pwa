import { useRef } from "react";

import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import getBaseMapPoseFromOverlayGesture from "Features/baseMaps/js/getBaseMapPoseFromOverlayGesture";
import { applyBaseMapMatrix } from "Features/baseMaps/js/getBaseMapToBaseMapPxMatrix";

import { OVERLAY_CONTENT_ATTRIBUTE } from "../constants/baseMapOverlayConstants";

// Selection + move / rotate of the base maps overlaid on the main one (2D
// editor, see useBaseMapOverlays).
//
// - Every overlay shows its NAME under its bottom-left corner: a click on it
//   selects the base map (BASE_MAP selection item → its properties panel).
// - The selected overlay gets a frame; dragging its image MOVES it, the round
//   handle above its top edge ROTATES it about its centre (Shift = 15° steps;
//   HORIZONTAL base maps only — a VERTICAL one cannot turn inside its plane).
//   A plain click on the image deselects.
// - Fully imperative gesture (PrintZoneLayer pattern): pointer capture +
//   preventDefault on pointerdown, so the editor's mousedown pipeline (pan /
//   draw / clearSelection) never sees it; every pointermove only rewrites the
//   `transform` attribute of the frame group (here) and of the content group
//   (NodeBaseMapOverlay, found by attribute). Nothing re-renders until the ONE
//   db write on pointerup re-emits the base map: React then rewrites both
//   transforms with the committed matrix. Escape / pointercancel restores.
// - data-capture-hide: never in the captured / exported images.

const INTERACTION = "transform-overlay-base-map";
const NAME_COLOR = "#9e9e9e";
const FRAME_STROKE = "#2196f3";
const NAME_FONT_SIZE = 11;
const NAME_LINE_PX = 14;
const ROTATE_HANDLE_OFFSET_PX = 26;
const ROTATE_HANDLE_RADIUS_PX = 5;
const ROTATE_STEP_DEG = 15;
const DRAG_THRESHOLD_PX = 3;

// (-180, 180]
const normalizeDeg = (deg) => {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};

export default function OverlayBaseMapsTransformLayer({
  overlays,
  hostBaseMap,
  basePose,
  selectedBaseMapId,
  interactive,
  onSelect, // (baseMapId) → BASE_MAP selection item
  onDeselect,
  onCommit, // async (baseMapId, { position, angleDeg }) → true when written
}) {
  // state

  const gRef = useRef(null); // outer group (camera frame): pointer capture
  const angleTextRef = useRef(null); // live angle readout (selected overlay)
  // { handleType: SELECT | MOVE | ROTATE, baseMapId, overlay, frameEl,
  //   contentEl, matrixStr, startClient, screenScale, centerPx, centerClient,
  //   lastRawDeg, accumDeg, active, next, pointerId, onKeyDown }
  const dragRef = useRef(null);

  if (!overlays?.length || !basePose) return null;

  const k = basePose.k || 1;
  const poseTransform = `translate(${basePose.x}, ${basePose.y}) scale(${k})`;

  // helpers

  const applyLive = (drag, prefix) => {
    const transform = prefix ? `${prefix} ${drag.matrixStr}` : drag.matrixStr;
    drag.frameEl?.setAttribute("transform", transform);
    drag.contentEl?.setAttribute("transform", transform);
  };

  const setAngleReadout = (text) => {
    if (angleTextRef.current) angleTextRef.current.textContent = text;
  };

  const endDrag = (drag) => {
    dragRef.current = null;
    window.removeEventListener("keydown", drag.onKeyDown, true);
    gRef.current?.releasePointerCapture?.(drag.pointerId);
    setAngleReadout("");
  };

  // handlers

  const handlePointerDown = (e) => {
    const el = e.target?.closest?.(`[data-interaction="${INTERACTION}"]`);
    if (!el || !interactive || e.button !== 0) return;
    const baseMapId = el.getAttribute("data-base-map-id");
    const overlay = overlays.find((o) => o.baseMap.id === baseMapId);
    if (!overlay) return;
    e.stopPropagation();
    e.preventDefault();

    const g = gRef.current;
    const frameEl = g?.querySelector(`[data-overlay-frame-id="${baseMapId}"]`);
    const contentEl = g?.ownerSVGElement?.querySelector(
      `[${OVERLAY_CONTENT_ATTRIBUTE}="${baseMapId}"]`
    );

    // Centre of the overlaid image: host px (commit) + client px (rotation).
    const size = overlay.baseMap.getImageSize?.();
    const centerLocal = {
      x: (size?.width || 0) / 2,
      y: (size?.height || 0) / 2,
    };
    const centerPx = applyBaseMapMatrix(overlay.matrix, centerLocal);
    const frameCtm = frameEl?.getScreenCTM?.();
    const centerClient = frameCtm
      ? {
          x:
            frameCtm.a * centerLocal.x +
            frameCtm.c * centerLocal.y +
            frameCtm.e,
          y:
            frameCtm.b * centerLocal.x +
            frameCtm.d * centerLocal.y +
            frameCtm.f,
        }
      : { x: e.clientX, y: e.clientY };
    const rawDeg =
      (Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) *
        180) /
      Math.PI;

    // Screen px per host px (the camera is never moved during a gesture).
    const ctm = g?.getScreenCTM?.();
    const cameraK = ctm ? Math.hypot(ctm.a, ctm.b) : 1;

    const drag = {
      handleType: el.getAttribute("data-handle-type"),
      baseMapId,
      overlay,
      frameEl,
      contentEl,
      matrixStr: overlay.matrixStr,
      startClient: { x: e.clientX, y: e.clientY },
      screenScale: (cameraK || 1) * k,
      centerPx,
      centerClient,
      lastRawDeg: rawDeg,
      accumDeg: 0,
      active: false,
      next: null,
      pointerId: e.pointerId,
      onKeyDown: (event) => {
        if (event.key !== "Escape" || dragRef.current !== drag) return;
        event.stopPropagation();
        applyLive(drag, null);
        endDrag(drag);
      },
    };
    dragRef.current = drag;
    window.addEventListener("keydown", drag.onKeyDown, true);
    g?.setPointerCapture?.(e.pointerId);
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
      const moved =
        Math.abs(D.x) > DRAG_THRESHOLD_PX || Math.abs(D.y) > DRAG_THRESHOLD_PX;
      if (drag.handleType === "SELECT" || !moved) return;
      drag.active = true;
    }

    if (drag.handleType === "MOVE") {
      // Screen → host px.
      const d = { x: D.x / drag.screenScale, y: D.y / drag.screenScale };
      drag.next = {
        nextCenterPx: { x: drag.centerPx.x + d.x, y: drag.centerPx.y + d.y },
        deltaDeg: 0,
      };
      applyLive(drag, `translate(${d.x} ${d.y})`);
      return;
    }

    // ROTATE about the image centre: the camera has no rotation, so the
    // on-screen angle IS the SVG angle (clockwise, y down). Unwrapped across
    // ±180° so several turns keep adding up.
    const rawDeg =
      (Math.atan2(
        e.clientY - drag.centerClient.y,
        e.clientX - drag.centerClient.x
      ) *
        180) /
      Math.PI;
    drag.accumDeg += normalizeDeg(rawDeg - drag.lastRawDeg);
    drag.lastRawDeg = rawDeg;
    const deltaDeg = e.shiftKey
      ? Math.round(drag.accumDeg / ROTATE_STEP_DEG) * ROTATE_STEP_DEG
      : drag.accumDeg;
    drag.next = { nextCenterPx: drag.centerPx, deltaDeg };
    applyLive(
      drag,
      `rotate(${deltaDeg} ${drag.centerPx.x} ${drag.centerPx.y})`
    );
    setAngleReadout(`${normalizeDeg(deltaDeg).toFixed(1)}°`);
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    endDrag(drag);
    if (e.type === "pointercancel") {
      applyLive(drag, null);
      return;
    }
    if (!drag.active) {
      if (drag.handleType === "SELECT") onSelect?.(drag.baseMapId);
      else if (drag.handleType === "MOVE") onDeselect?.();
      return;
    }
    const { next } = drag;
    const unchanged =
      !next || (drag.handleType === "ROTATE" && next.deltaDeg % 360 === 0);
    const patch = unchanged
      ? null
      : getBaseMapPoseFromOverlayGesture({
          source: drag.overlay.baseMap,
          host: hostBaseMap,
          centerPx: drag.centerPx,
          nextCenterPx: next.nextCenterPx,
          deltaDeg: next.deltaDeg,
        });
    if (!patch) {
      applyLive(drag, null);
      return;
    }
    // The live transform stays until the record re-emits.
    Promise.resolve(onCommit?.(drag.baseMapId, patch)).then((written) => {
      if (!written) applyLive(drag, null);
    });
  };

  // render

  return (
    <g
      data-capture-hide
      ref={gRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseDown={(e) => {
        // The editor's pan / draw listens on mousedown too.
        if (e.target?.closest?.(`[data-interaction="${INTERACTION}"]`)) {
          e.stopPropagation();
        }
      }}
    >
      <g transform={poseTransform}>
        {overlays.map((overlay, index) => {
          const { baseMap, matrix, matrixStr } = overlay;
          const size = baseMap.getImageSize?.();
          const W = size?.width || 0;
          const H = size?.height || 0;
          if (!W || !H) return null;
          const selected = baseMap.id === selectedBaseMapId;
          const canRotate =
            getBaseMapTransform(baseMap).orientation !== "VERTICAL";
          const counterZoom = `scale(calc(1 / (var(--map-zoom, 1) * ${
            k * matrix.scale
          })))`;
          const dataProps = {
            "data-interaction": INTERACTION,
            "data-base-map-id": baseMap.id,
          };

          return (
            <g
              key={baseMap.id}
              data-overlay-frame-id={baseMap.id}
              transform={matrixStr}
            >
              {selected && interactive && (
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  fill="transparent"
                  style={{ pointerEvents: "all", cursor: "move" }}
                  {...dataProps}
                  data-handle-type="MOVE"
                />
              )}
              {selected && (
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  fill="none"
                  stroke={FRAME_STROKE}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* rotate handle, above the middle of the top edge */}
              {selected && interactive && canRotate && (
                <g transform={`translate(${W / 2}, 0)`}>
                  <g style={{ transform: counterZoom }}>
                    <line
                      x1={0}
                      y1={0}
                      x2={0}
                      y2={-ROTATE_HANDLE_OFFSET_PX}
                      stroke={FRAME_STROKE}
                      strokeWidth={1}
                      style={{ pointerEvents: "none" }}
                    />
                    <circle
                      cx={0}
                      cy={-ROTATE_HANDLE_OFFSET_PX}
                      r={ROTATE_HANDLE_RADIUS_PX}
                      fill="white"
                      stroke={FRAME_STROKE}
                      strokeWidth={1}
                      style={{ pointerEvents: "all", cursor: "grab" }}
                      {...dataProps}
                      data-handle-type="ROTATE"
                    />
                    <text
                      ref={angleTextRef}
                      x={ROTATE_HANDLE_RADIUS_PX + 6}
                      y={-ROTATE_HANDLE_OFFSET_PX + 4}
                      fontSize={NAME_FONT_SIZE}
                      fill={FRAME_STROKE}
                      fontFamily="inherit"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    />
                  </g>
                </g>
              )}

              {/* name, under the bottom-left corner — one line per overlay so
                  stacked base maps (and the main one's own name, first line)
                  never overlap */}
              <g transform={`translate(0, ${H})`}>
                <g style={{ transform: counterZoom }}>
                  <text
                    x={0}
                    y={12 + NAME_LINE_PX * (index + 1)}
                    fontSize={NAME_FONT_SIZE}
                    fill={selected ? FRAME_STROKE : NAME_COLOR}
                    fontFamily="inherit"
                    style={{
                      pointerEvents: interactive ? "all" : "none",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    {...dataProps}
                    data-handle-type="SELECT"
                  >
                    {getBaseMapDisplayName(baseMap).label}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </g>
    </g>
  );
}
