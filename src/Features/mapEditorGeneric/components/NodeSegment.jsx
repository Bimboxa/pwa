// NodeSegment.js
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";

import theme from "Styles/theme";

/**
 * Props:
 * - segment: {
 *     id?: string,
 *     listingId?: string,
 *     points: Array<{x:number,y:number}>, // relative 0..1 (should be exactly 2 points)
 *     strokeColor?: string,
 *     fillColor?: string,
 *   }
 * - imageSize: { w:number, h:number }                  // base image px
 * - toBaseFromClient: (clientX:number, clientY:number) => { x:number, y:number } // base-local px
 * - isDrawing?: boolean
 * - onComplete?: (points) => void                      // finalize segment (called after 2nd click)
 * - onPointsChange?: (points) => void                  // after anchor drag
 * - onChange?: (segment) => void                       // legacy (full object)
 * - selected?: boolean                                 // show anchors when true
 * - worldScale?: number                                // world zoom scale
 * - containerK?: number                                // container scale
 */
export default function NodeSegment({
  segment,
  imageSize,
  toBaseFromClient,
  isDrawing = false,
  onComplete,
  onPointsChange,
  onChange,
  selected,
  worldScale = 1,
  containerK = 1,
}) {
  // --- data props for hit-testing in your editor ---
  const dataProps = {
    "data-node-id": segment?.id,
    "data-node-listing-id": segment?.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "SEGMENT",
  };

  // --- segment config ---
  const basePoints = segment?.points || [];
  const {
    strokeColor = segment?.strokeColor ??
      segment?.fillColor ??
      theme.palette.secondary.main,
    fillColor = segment?.fillColor ?? theme.palette.secondary.main,
  } = segment || {};

  // --- image size ---
  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // --- UI constants ---
  const HIT_R = 12; // px, anchor hit radius in SCREEN space
  const ANCHOR_R = 4; // px, visual anchor radius in SCREEN space
  const ANCHOR_R_HOVERED = 5; // px, hovered anchor radius in SCREEN space
  const STROKE_WIDTH = 2; // px, base stroke width
  const STROKE_WIDTH_HOVER = 3; // px, hovered stroke width
  const HOVER_HIT_WIDTH = 12; // px, invisible hover area width
  const TEMP_STROKE_WIDTH = 2; // px, temporary drawing lines width

  // Calculate the inverse scale to keep elements constant screen size
  const totalScale = worldScale * containerK;
  const invScale = totalScale > 0 ? 1 / totalScale : 1;

  // Calculate stroke widths - always scale to maintain constant screen size
  const baseStrokeWidth = STROKE_WIDTH * invScale;
  const hoverStrokeWidth = STROKE_WIDTH_HOVER * invScale;
  const hitStrokeWidth = HOVER_HIT_WIDTH * invScale;
  const tempStrokeWidth = TEMP_STROKE_WIDTH * invScale;

  // ----- Hover + dragging state -----
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingRef = useRef({ active: false, idx: -1, pointerId: null });

  // temp points while dragging (and rAF throttle)
  const tempPointsRef = useRef(null);
  const [tempPoints, setTempPoints] = useState(null);
  const rafIdRef = useRef(null);

  useLayoutEffect(() => {
    tempPointsRef.current = null;
    setTempPoints(null);
  }, [segment]);

  // drawing preview (moving mouse point)
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const nextPosRef = useRef(null);
  const moveRafRef = useRef(null);

  // ---------- helpers ----------
  const scheduleTempCommit = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setTempPoints(tempPointsRef.current ? [...tempPointsRef.current] : null);
    });
  };

  // Constrain a base-local px point to H/V relative to a base-local px origin when Shift is pressed.
  function constrainIfShift(e, ptPx, originPx) {
    if (!e.shiftKey || !originPx) return ptPx;
    const dx = ptPx.x - originPx.x;
    const dy = ptPx.y - originPx.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      // angle < 45° → horizontal
      return { x: ptPx.x, y: originPx.y };
    } else {
      // angle > 45° → vertical
      return { x: originPx.x, y: ptPx.y };
    }
  }

  // ---------- Anchor drag ----------
  function onAnchorPointerDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();

    draggingRef.current = {
      active: true,
      idx,
      pointerId: e.pointerId ?? "mouse",
    };

    document.addEventListener("pointermove", onDocPointerMove, {
      passive: false,
    });
    document.addEventListener("pointerup", onDocPointerUp, { passive: false });
    document.addEventListener("pointercancel", onDocPointerUp, {
      passive: false,
    });

    tempPointsRef.current = basePoints.map((p) => ({ ...p }));
    scheduleTempCommit();
  }

  function onDocPointerMove(e) {
    if (!draggingRef.current.active) return;

    // pick the OTHER point as reference for Shift constraint
    const i = draggingRef.current.idx;
    const otherIdx = i === 0 ? 1 : 0;
    const refRel = basePoints[otherIdx] ?? null;
    const refPx = refRel ? { x: refRel.x * w, y: refRel.y * h } : null;

    // current mouse in base-local px
    let bl = toBaseFromClient(e.clientX, e.clientY);
    // apply Shift constrain if needed
    bl = constrainIfShift(e, bl, refPx);

    const rx = Math.max(0, Math.min(1, bl.x / w));
    const ry = Math.max(0, Math.min(1, bl.y / h));

    if (!tempPointsRef.current)
      tempPointsRef.current = basePoints.map((p) => ({ ...p }));
    tempPointsRef.current[i] = { x: rx, y: ry };
    scheduleTempCommit();

    e.preventDefault(); // avoid scroll on touchpads while dragging
  }

  function onDocPointerUp() {
    if (!draggingRef.current.active) return;
    draggingRef.current.active = false;

    const finalPoints = tempPointsRef.current
      ? tempPointsRef.current.map((p) => ({ ...p }))
      : basePoints.map((p) => ({ ...p }));

    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);

    if (onPointsChange) onPointsChange(finalPoints);
    if (onChange) onChange({ ...segment, points: finalPoints });
  }

  // Refs for drawing mode
  const toBaseFromClientRef = useRef(toBaseFromClient);
  const basePointsRef = useRef(basePoints);
  const wRef = useRef(w);
  const hRef = useRef(h);

  // Update refs on every render
  useEffect(() => {
    toBaseFromClientRef.current = toBaseFromClient;
    basePointsRef.current = basePoints;
    wRef.current = w;
    hRef.current = h;
  });

  // ---------- Drawing mode: live mouse point ----------
  useEffect(() => {
    if (!isDrawing) {
      setCurrentMousePos(null);
      return;
    }

    function onMove(e) {
      const currentW = wRef.current;
      const currentH = hRef.current;
      const currentBasePoints = basePointsRef.current;
      const currentToBaseFromClient = toBaseFromClientRef.current;

      // If we already have 2 points, don't show preview
      if (currentBasePoints.length >= 2) {
        setCurrentMousePos(null);
        return;
      }

      // Show cursor position for first point or moving line for second point
      const lastRel =
        currentBasePoints.length > 0
          ? currentBasePoints[currentBasePoints.length - 1]
          : null;
      const lastPx = lastRel
        ? { x: lastRel.x * currentW, y: lastRel.y * currentH }
        : null;

      // base-local px
      let bl = currentToBaseFromClient(e.clientX, e.clientY);
      // Shift constrain vs LAST committed point while drawing
      bl = constrainIfShift(e, bl, lastPx);

      // update preview position (relative 0..1)
      const rx = bl.x / currentW;
      const ry = bl.y / currentH;

      nextPosRef.current = { x: rx, y: ry };

      if (moveRafRef.current == null) {
        moveRafRef.current = requestAnimationFrame(() => {
          moveRafRef.current = null;
          if (nextPosRef.current) {
            setCurrentMousePos({
              x: nextPosRef.current.x,
              y: nextPosRef.current.y,
            });
          }
        });
      }
    }

    document.addEventListener("mousemove", onMove);

    return () => {
      document.removeEventListener("mousemove", onMove);
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    };
  }, [isDrawing]);

  // ---------- Build preview with moving vertex appended ----------
  const committedRel = useMemo(
    () => tempPoints ?? basePoints,
    [tempPoints, basePoints]
  );

  const previewRel = useMemo(() => {
    // If drawing and we have 1 point, show preview line to cursor
    if (isDrawing && currentMousePos && committedRel.length === 1) {
      return [...committedRel, currentMousePos];
    }
    // If drawing but no points yet, just show cursor position
    if (isDrawing && currentMousePos && committedRel.length === 0) {
      return [currentMousePos];
    }
    return committedRel;
  }, [isDrawing, currentMousePos, committedRel]);

  const previewPx = useMemo(
    () => previewRel.map((p) => ({ x: p.x * w, y: p.y * h })),
    [previewRel, w, h]
  );

  const lastCommitted = committedRel.length
    ? committedRel[committedRel.length - 1]
    : null;

  // cleanup
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);
    };
  }, []);

  return (
    <g {...dataProps}>
      {/* WIDE INVISIBLE OVERLAY (hover/click comfort) - only for completed segments */}
      {!isDrawing && previewPx.length === 2 && (
        <line
          x1={previewPx[0].x}
          y1={previewPx[0].y}
          x2={previewPx[1].x}
          y2={previewPx[1].y}
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoverIdx("line")}
          onMouseLeave={() => setHoverIdx(null)}
        />
      )}

      {/* VISIBLE LINE - completed segment */}
      {!isDrawing && previewPx.length === 2 && (
        <line
          x1={previewPx[0].x}
          y1={previewPx[0].y}
          x2={previewPx[1].x}
          y2={previewPx[1].y}
          stroke={hoverIdx != null ? "#0066cc" : strokeColor}
          strokeWidth={hoverStrokeWidth}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* TEMP MOVING LINE (during drawing, from first point to cursor) */}
      {isDrawing && currentMousePos && lastCommitted && (
        <line
          x1={lastCommitted.x * w}
          y1={lastCommitted.y * h}
          x2={currentMousePos.x * w}
          y2={currentMousePos.y * h}
          stroke={strokeColor}
          strokeWidth={hoverStrokeWidth}
          opacity="1"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* FIRST POINT INDICATOR (during drawing after first click) */}
      {isDrawing && committedRel.length === 1 && (
        <circle
          cx={committedRel[0].x * w}
          cy={committedRel[0].y * h}
          r={ANCHOR_R_HOVERED * invScale}
          fill={fillColor}
          stroke="#ffffff"
          strokeWidth={2 * invScale}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* ANCHOR HANDLES (only when selected, not drawing) */}
      {selected &&
        !isDrawing &&
        committedRel.map((p, i) => {
          const px = p.x * w;
          const py = p.y * h;
          const hovered =
            hoverIdx === i ||
            (draggingRef.current.active && draggingRef.current.idx === i);

          return (
            <g key={`anchor-${i}`}>
              <circle
                cx={px}
                cy={py}
                r={HIT_R * invScale}
                fill="transparent"
                stroke="transparent"
                style={{
                  cursor: draggingRef.current.active ? "grabbing" : "grab",
                }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() =>
                  !draggingRef.current.active && setHoverIdx(null)
                }
                onPointerDown={(e) => onAnchorPointerDown(e, i)}
              />
              <circle
                cx={px}
                cy={py}
                r={(hovered ? ANCHOR_R_HOVERED : ANCHOR_R) * invScale}
                fill={hovered ? "#0066cc" : "#ff0000"}
                stroke="#ffffff"
                strokeWidth={2 * invScale}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}
    </g>
  );
}
