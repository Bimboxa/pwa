// NodePolyline.js
import { useState, useEffect, useRef, useMemo } from "react";

/**
 * Props:
 * - polyline: { points: Array<{x:number,y:number}> }   // points are relative (0..1)
 * - imageSize: { w:number, h:number }                  // base image size (px)
 * - toBaseFromClient: (clientX:number, clientY:number) => { x:number, y:number } // base-local px
 * - isDrawing?: boolean                                 // optional: if true, shows a moving preview segment (like "add next point")
 * - onComplete?: (points) => void                       // optional: called on dblclick when in drawing mode
 * - onPointsChange?: (points) => void                   // called when a drag finishes (drop)
 *
 * Notes:
 * - Dragging works on the circular anchors (bigger transparent hit area).
 * - While dragging we update a temp copy of points and paint it; on drop we call onPointsChange.
 */
export default function NodePolyline({
  polyline,
  imageSize,
  toBaseFromClient,
  isDrawing = false,
  onComplete,
  onPointsChange, // preferred name
  onChange, // backward compatibility with your earlier prop
}) {
  const basePoints = polyline?.points || [];
  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // ----- Hover + dragging state -----
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingRef = useRef({ active: false, idx: -1, pointerId: null });

  // temp points while dragging (and rAF throttle)
  const tempPointsRef = useRef(null);
  const [tempPoints, setTempPoints] = useState(null);
  const rafIdRef = useRef(null);

  // optional preview for "next segment" when isDrawing = true
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const nextPosRef = useRef(null);
  const moveRafRef = useRef(null);

  const effectiveOnChange = onChange;

  // ---------- rAF setter for temp points (drag preview) ----------
  const scheduleTempCommit = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setTempPoints(tempPointsRef.current ? [...tempPointsRef.current] : null);
    });
  };

  // ---------- Pointer handlers for anchor drag ----------
  function onAnchorPointerDown(e, idx) {
    // capture drag on this anchor; don’t let the map pan get it
    e.preventDefault();
    e.stopPropagation();

    const id = e.pointerId ?? "mouse";
    draggingRef.current = { active: true, idx, pointerId: id };

    // listen on the document so we track even if pointer leaves the svg
    document.addEventListener("pointermove", onDocPointerMove, {
      passive: false,
    });
    document.addEventListener("pointerup", onDocPointerUp, { passive: false });
    document.addEventListener("pointercancel", onDocPointerUp, {
      passive: false,
    });

    // start from current polyline points
    tempPointsRef.current = basePoints.map((p) => ({ ...p }));
    scheduleTempCommit();
  }

  function onDocPointerMove(e) {
    if (!draggingRef.current.active) return;

    // convert to base-local px, then to relative 0..1
    const bl = toBaseFromClient(e.clientX, e.clientY);
    const rx = Math.max(0, Math.min(1, bl.x / w));
    const ry = Math.max(0, Math.min(1, bl.y / h));

    const i = draggingRef.current.idx;
    if (!tempPointsRef.current)
      tempPointsRef.current = basePoints.map((p) => ({ ...p }));
    tempPointsRef.current[i] = { x: rx, y: ry };
    scheduleTempCommit();

    // prevent page scrolling while dragging on touchpads
    e.preventDefault();
  }

  function onDocPointerUp(e) {
    if (!draggingRef.current.active) return;

    draggingRef.current.active = false;

    // finalize + notify
    const finalPoints = tempPointsRef.current
      ? tempPointsRef.current.map((p) => ({ ...p }))
      : basePoints.map((p) => ({ ...p }));

    tempPointsRef.current = null;
    setTempPoints(null);

    // clean up listeners
    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);

    // callback after drop
    if (effectiveOnChange)
      effectiveOnChange({ ...polyline, points: finalPoints });
  }

  // ---------- Optional drawing preview (like "add next point") ----------
  useEffect(() => {
    if (!isDrawing) {
      setCurrentMousePos(null);
      return;
    }

    function onMove(e) {
      const bl = toBaseFromClient(e.clientX, e.clientY);
      const rx = bl.x / w;
      const ry = bl.y / h;

      nextPosRef.current = { x: rx, y: ry };
      if (moveRafRef.current == null) {
        moveRafRef.current = requestAnimationFrame(() => {
          moveRafRef.current = null;
          if (nextPosRef.current) setCurrentMousePos(nextPosRef.current);
        });
      }
    }

    function onDblClick() {
      if (basePoints.length >= 2) {
        onComplete && onComplete(basePoints);
        setCurrentMousePos(null);
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
  }, [isDrawing, w, h, toBaseFromClient, basePoints, onComplete]);

  // ---------- What we actually render ----------
  const renderPoints = useMemo(() => {
    const pts = (tempPoints ?? basePoints).map((p) => ({
      x: p.x * w,
      y: p.y * h,
    }));
    if (isDrawing && currentMousePos && basePoints.length > 0) {
      pts.push({ x: currentMousePos.x * w, y: currentMousePos.y * h });
    }
    return pts;
  }, [tempPoints, basePoints, w, h, isDrawing, currentMousePos]);

  const lastCommitted = basePoints.length
    ? basePoints[basePoints.length - 1]
    : null;

  // cleanup any pending rAF when unmounting
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
      // remove listeners just in case
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);
    };
  }, []);

  return (
    <g>
      {/* Wide invisible path for easier hover on the line */}
      {renderPoints.length >= 2 && (
        <polyline
          points={renderPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoverIdx("line")}
          onMouseLeave={() => setHoverIdx(null)}
        />
      )}

      {/* Visible path */}
      {renderPoints.length >= 2 && (
        <polyline
          points={renderPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={hoverIdx != null ? "#0066cc" : "#ff0000"}
          strokeWidth={hoverIdx != null ? 3 : 2}
          strokeDasharray="5,5"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Optional visible preview of the last segment while drawing */}
      {isDrawing && lastCommitted && currentMousePos && (
        <line
          x1={lastCommitted.x * w}
          y1={lastCommitted.y * h}
          x2={currentMousePos.x * w}
          y2={currentMousePos.y * h}
          stroke="#ff0000"
          strokeWidth="2"
          strokeDasharray="3,3"
          opacity="0.7"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Anchor handles (transparent big hit area) */}
      {(tempPoints ?? basePoints).map((p, i) => {
        const px = p.x * w;
        const py = p.y * h;
        const hovered =
          hoverIdx === i ||
          (draggingRef.current.active && draggingRef.current.idx === i);

        return (
          <g key={`anchor-${i}`}>
            {/* Big transparent hit circle to make grabbing easy */}
            <circle
              cx={px}
              cy={py}
              r={12}
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
            {/* Visible small circle */}
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
