// NodePolyline.js
import { useState, useEffect, useRef, useMemo } from "react";

/**
 * Props:
 * - polyline: {
 *     id?: string,
 *     listingId?: string,
 *     points: Array<{x:number,y:number}>, // relative 0..1
 *     strokeColor?: string,
 *     closeLine?: boolean,
 *     fillColor?: string,
 *     fillOpacity?: number,
 *   }
 * - imageSize: { w:number, h:number }                  // base image px
 * - toBaseFromClient: (clientX:number, clientY:number) => { x:number, y:number } // base-local px
 * - isDrawing?: boolean
 * - onComplete?: (points) => void                      // finalize polygon
 * - onPointsChange?: (points) => void                  // after anchor drag
 * - onChange?: (polyline) => void                      // legacy (full object)
 * - selected?: boolean                                 // show anchors when true
 */
export default function NodePolyline({
  polyline,
  imageSize,
  toBaseFromClient,
  isDrawing = false,
  onComplete,
  onPointsChange,
  onChange,
  selected,
}) {
  // --- data props for hit-testing in your editor ---
  const dataProps = {
    "data-node-id": polyline?.id,
    "data-node-listing-id": polyline?.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "POLYLINE",
  };

  // --- polyline config ---
  const basePoints = polyline?.points || [];
  const {
    strokeColor = "green",
    closeLine = false,
    fillColor = polyline?.strokeColor || "green",
    fillOpacity = 0.8,
  } = polyline || {};

  // --- image size ---
  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // --- UI constants ---
  const HIT_R = 12; // px, anchor hit radius
  const CLOSE_TOL_PX = 14; // px in *base* space (tweak/scale if needed)

  // ----- Hover + dragging state -----
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingRef = useRef({ active: false, idx: -1, pointerId: null });

  // temp points while dragging (and rAF throttle)
  const tempPointsRef = useRef(null);
  const [tempPoints, setTempPoints] = useState(null);
  const rafIdRef = useRef(null);

  // drawing preview (moving mouse point)
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const nextPosRef = useRef(null);
  const moveRafRef = useRef(null);

  // closing helper (near first point while drawing)
  const [showCloseHelper, setShowCloseHelper] = useState(false);

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

    // pick a reference anchor for Shift constraint: prefer previous, else next
    const i = draggingRef.current.idx;
    const prev = basePoints[i - 1] ?? null;
    const next = basePoints[i + 1] ?? null;
    const refRel = prev || next || null;
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

    tempPointsRef.current = null;
    setTempPoints(null);

    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);

    if (onPointsChange) onPointsChange(finalPoints);
    if (onChange) onChange({ ...polyline, points: finalPoints });
  }

  // ---------- Drawing mode: live mouse point + closing helper ----------
  useEffect(() => {
    if (!isDrawing) {
      setCurrentMousePos(null);
      setShowCloseHelper(false);
      return;
    }

    const lastRel = basePoints[basePoints.length - 1] || null;
    const lastPx = lastRel ? { x: lastRel.x * w, y: lastRel.y * h } : null;

    const firstRel = basePoints[0] || null;
    const firstPx = firstRel ? { x: firstRel.x * w, y: firstRel.y * h } : null;

    function onMove(e) {
      // base-local px
      let bl = toBaseFromClient(e.clientX, e.clientY);
      // Shift constrain vs LAST committed point while drawing
      bl = constrainIfShift(e, bl, lastPx);

      // update preview position (relative 0..1)
      const rx = bl.x / w;
      const ry = bl.y / h;

      // closing helper (distance test in base px)
      let showClose = false;
      if (closeLine && firstPx) {
        const dx = bl.x - firstPx.x;
        const dy = bl.y - firstPx.y;
        if (Math.hypot(dx, dy) <= CLOSE_TOL_PX) {
          showClose = true;
        }
      }

      nextPosRef.current = { x: rx, y: ry, showClose };

      if (moveRafRef.current == null) {
        moveRafRef.current = requestAnimationFrame(() => {
          moveRafRef.current = null;
          if (nextPosRef.current) {
            setCurrentMousePos({
              x: nextPosRef.current.x,
              y: nextPosRef.current.y,
            });
            setShowCloseHelper(nextPosRef.current.showClose);
          }
        });
      }
    }

    function onDblClick() {
      if (basePoints.length >= 2) {
        onComplete && onComplete(basePoints);
        setCurrentMousePos(null);
        setShowCloseHelper(false);
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("dblclick", onDblClick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("dblclick", onDblClick);
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    };
  }, [
    isDrawing,
    w,
    h,
    toBaseFromClient,
    basePoints,
    onComplete,
    closeLine,
    CLOSE_TOL_PX,
  ]);

  // ---------- Build preview with moving vertex appended ----------
  const committedRel = useMemo(
    () => tempPoints ?? basePoints,
    [tempPoints, basePoints]
  );

  const previewRel = useMemo(() => {
    if (isDrawing && currentMousePos && committedRel.length > 0) {
      return [...committedRel, currentMousePos];
    }
    return committedRel;
  }, [isDrawing, currentMousePos, committedRel]);

  const previewPx = useMemo(
    () => previewRel.map((p) => ({ x: p.x * w, y: p.y * h })),
    [previewRel, w, h]
  );

  // helper overlay path (polyline). If closeLine → include closing edge
  const helperPointsStr = useMemo(() => {
    if (previewPx.length === 0) return "";
    const list =
      closeLine && previewPx.length >= 2
        ? [...previewPx, previewPx[0]]
        : previewPx;
    return list.map((p) => `${p.x},${p.y}`).join(" ");
  }, [previewPx, closeLine]);

  // polygon points (no duplicate of the first point)
  const polygonPointsStr = useMemo(
    () => previewPx.map((p) => `${p.x},${p.y}`).join(" "),
    [previewPx]
  );

  const lastCommitted = committedRel.length
    ? committedRel[committedRel.length - 1]
    : null;
  const firstCommitted = committedRel.length ? committedRel[0] : null;

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

  const showFill = closeLine && previewRel.length >= 3;

  return (
    <g {...dataProps}>
      {/* FILLED POLYGON (preview includes moving vertex) */}
      {showFill && (
        <polygon
          points={polygonPointsStr}
          fill={fillColor}
          fillOpacity={fillOpacity ?? 0.8}
          stroke="none"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* WIDE INVISIBLE OVERLAY (hover/click comfort) */}
      {previewPx.length >= 2 && (
        <polyline
          points={helperPointsStr}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoverIdx("line")}
          onMouseLeave={() => setHoverIdx(null)}
        />
      )}

      {/* VISIBLE OUTLINE */}
      {previewPx.length >= 2 && !closeLine && (
        <polyline
          points={helperPointsStr}
          fill="none"
          stroke={hoverIdx != null ? "#0066cc" : strokeColor}
          strokeWidth={hoverIdx != null ? 3 : 2}
          strokeDasharray="5,5"
          style={{ pointerEvents: "none" }}
        />
      )}
      {previewPx.length >= 2 && closeLine && (
        <polygon
          points={polygonPointsStr}
          fill="none"
          stroke={hoverIdx != null ? "#0066cc" : strokeColor}
          strokeWidth={hoverIdx != null ? 3 : 2}
          strokeDasharray="5,5"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* TEMP MOVING SEGMENTS */}
      {isDrawing && currentMousePos && lastCommitted && (
        <line
          x1={lastCommitted.x * w}
          y1={lastCommitted.y * h}
          x2={currentMousePos.x * w}
          y2={currentMousePos.y * h}
          stroke={strokeColor}
          strokeWidth="2"
          strokeDasharray="3,3"
          opacity="0.9"
          style={{ pointerEvents: "none" }}
        />
      )}
      {isDrawing &&
        closeLine &&
        currentMousePos &&
        firstCommitted &&
        committedRel.length >= 1 && (
          <line
            x1={currentMousePos.x * w}
            y1={currentMousePos.y * h}
            x2={firstCommitted.x * w}
            y2={firstCommitted.y * h}
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray="3,3"
            opacity="0.9"
            style={{ pointerEvents: "none" }}
          />
        )}

      {/* CLOSING HELPER ANCHOR (click to commit) */}
      {isDrawing && closeLine && showCloseHelper && firstCommitted && (
        <g
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation(); // prevent "add point" handler upstream
            if (onComplete) onComplete(basePoints);
            setCurrentMousePos(null);
            setShowCloseHelper(false);
          }}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={firstCommitted.x * w}
            cy={firstCommitted.y * h}
            r={HIT_R}
            fill="rgba(0,0,0,0.05)"
            stroke="#0066cc"
            strokeWidth="2"
          />
          <circle
            cx={firstCommitted.x * w}
            cy={firstCommitted.y * h}
            r={5}
            fill="#0066cc"
            stroke="#fff"
            strokeWidth="2"
            style={{ pointerEvents: "none" }}
          />
        </g>
      )}

      {/* ANCHOR HANDLES */}
      {selected &&
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
                r={HIT_R}
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
                r={hovered ? 5 : 4}
                fill={hovered ? "#0066cc" : "#ff0000"}
                stroke="#ffffff"
                strokeWidth="2"
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}
    </g>
  );
}
