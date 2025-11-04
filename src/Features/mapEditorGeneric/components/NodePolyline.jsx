// NodePolyline.js
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import theme from "Styles/theme";

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
  baseMapMeterByPx,
  toBaseFromClient,
  isDrawing = false,
  onComplete,
  onPointsChange,
  onChange,
  selected,
  worldScale = 1, // ← Add this
  containerK = 1, // ← Add this
}) {
  // data

  const dispatch = useDispatch();
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);

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
    strokeColor = polyline?.strokeColor ??
      polyline?.fillColor ??
      theme.palette.secondary.main,
    closeLine = false,
    fillColor = polyline?.fillColor ?? theme.palette.secondary.main,
    fillOpacity = polyline?.fillOpacity ?? 0.8,
    fillType = polyline?.fillType ?? "SOLID",

    strokeType = polyline?.strokeType ?? "SOLID",
    strokeOpacity = polyline?.strokeOpacity ?? 1,
    strokeWidth = polyline?.strokeWidth ?? 2,
    strokeWidthUnit = polyline?.strokeWidthUnit ?? "PX",
  } = polyline || {};

  // --- image size ---
  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // --- UI constants ---
  const HIT_R = 12; // px, anchor hit radius in SCREEN space
  const ANCHOR_R = 4; // px, visual anchor radius in SCREEN space
  const ANCHOR_R_HOVERED = 5; // px, hovered anchor radius in SCREEN space
  const STROKE_WIDTH_HOVER = 3; // px, hovered stroke width
  const HOVER_HIT_WIDTH = 12; // px, invisible hover area width
  const TEMP_STROKE_WIDTH = 2; // px, temporary drawing lines width
  const CLOSE_TOL_PX = 14; // px in *base* space (tweak/scale if needed)
  const HATCHING_SPACING = 12; // px, fixed spacing in world reference when showBgImage is true

  // Calculate the inverse scale to keep elements constant screen size
  const totalScale = showBgImage ? 1 : worldScale * containerK;
  const invScale = totalScale > 0 ? (showBgImage ? 1 : 1 / totalScale) : 1;

  // Compute actual stroke width in px based on strokeWidth, strokeWidthUnit, and baseMapMeterByPx
  const computedStrokeWidthPx = useMemo(() => {
    let widthInPx = strokeWidth;
    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx;

    // Convert cm to px if needed
    if (isCmUnit) {
      // Convert cm to meters (1 cm = 0.01 m), then divide by meters per pixel
      const widthInMeters = strokeWidth * 0.01;
      widthInPx = widthInMeters / baseMapMeterByPx;
    }

    // If strokeWidthUnit is "CM" and baseMapMeterByPx is not null, keep the width consistent with baseMap
    // (don't scale inversely to keep constant screen size)
    if (isCmUnit) {
      return widthInPx;
    }

    // Apply scaling based on showBgImage for PX units
    // If showBgImage is false: scale inversely to keep constant screen size
    // If showBgImage is true: use the px value directly (already in base/world reference)
    return showBgImage ? widthInPx : widthInPx * invScale;
  }, [strokeWidth, strokeWidthUnit, baseMapMeterByPx, showBgImage, invScale]);

  // Compute stroke attributes based on strokeType
  const strokeProps = useMemo(() => {
    if (strokeType === "NONE") {
      return {
        stroke: "none",
        strokeOpacity: 0,
      };
    }

    const props = {
      stroke: strokeColor,
      strokeOpacity: strokeOpacity ?? 1,
      strokeWidth: computedStrokeWidthPx,
    };

    if (strokeType === "DASHED") {
      // Create a dash array proportional to stroke width
      const dashLength = computedStrokeWidthPx * 3;
      const gapLength = computedStrokeWidthPx * 2;
      props.strokeDasharray = `${dashLength} ${gapLength}`;
    }

    return props;
  }, [strokeType, strokeColor, strokeOpacity, computedStrokeWidthPx]);

  // Calculate other stroke widths - always scale to maintain constant screen size
  const hoverStrokeWidth = STROKE_WIDTH_HOVER * invScale;

  // Fixed 10px visual hit area width regardless of world/container scale
  const FIXED_HIT_WIDTH_VISUAL = 10; // px
  const hitStrokeWidth = useMemo(() => {
    if (showBgImage) {
      // When showBgImage is true, scale with containerK to maintain fixed visual size
      return FIXED_HIT_WIDTH_VISUAL / containerK;
    } else {
      // When showBgImage is false, use invScale to maintain fixed visual size
      return FIXED_HIT_WIDTH_VISUAL * invScale;
    }
  }, [showBgImage, containerK, invScale]);

  // ----- Hover + dragging state -----
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingRef = useRef({ active: false, idx: -1, pointerId: null });

  // Point insertion on hover
  const [segmentProjection, setSegmentProjection] = useState(null); // { segmentIdx: number, point: { x: number, y: number } (relative 0..1) }

  // temp points while dragging (and rAF throttle)
  const tempPointsRef = useRef(null);
  const [tempPoints, setTempPoints] = useState(null);
  const rafIdRef = useRef(null);

  useLayoutEffect(() => {
    tempPointsRef.current = null;
    setTempPoints(null);
  }, [polyline?.points?.reduce((acc, p) => acc + p.x + p.y, 0).toString()]);

  // Clear segment projection when selection or drawing state changes
  useEffect(() => {
    if (!selected || isDrawing || draggingRef.current.active) {
      setSegmentProjection(null);
    }
  }, [selected, isDrawing]);

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

  // Calculate orthogonal projection of point onto line segment and distance
  // Returns { projection: {x, y}, t: number (0..1), distSq: number } or null if no valid projection
  function projectOntoSegment(pointPx, segStartPx, segEndPx) {
    const dx = segEndPx.x - segStartPx.x;
    const dy = segEndPx.y - segStartPx.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-10) {
      // Degenerate segment (start === end)
      return null;
    }

    // t is the parametric position along the segment (0 = start, 1 = end)
    const t = Math.max(
      0,
      Math.min(
        1,
        ((pointPx.x - segStartPx.x) * dx + (pointPx.y - segStartPx.y) * dy) /
          lenSq
      )
    );

    const projection = {
      x: segStartPx.x + t * dx,
      y: segStartPx.y + t * dy,
    };

    const distSq =
      (pointPx.x - projection.x) ** 2 + (pointPx.y - projection.y) ** 2;

    return { projection, t, distSq };
  }

  // Find closest segment and projection point
  function findClosestSegmentAndProjection(mousePx, points) {
    if (points.length < 2) return null;

    let closestSegmentIdx = -1;
    let closestProjection = null;
    let minDistSq = Infinity;

    // Check each segment (including closing segment if closeLine)
    const numSegments = closeLine ? points.length : points.length - 1;

    for (let i = 0; i < numSegments; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const segStartPx = { x: p1.x * w, y: p1.y * h };
      const segEndPx = { x: p2.x * w, y: p2.y * h };

      const proj = projectOntoSegment(mousePx, segStartPx, segEndPx);
      if (proj && proj.distSq < minDistSq) {
        minDistSq = proj.distSq;
        closestSegmentIdx = i;
        closestProjection = {
          x: proj.projection.x / w,
          y: proj.projection.y / h,
          t: proj.t,
        };
      }
    }

    if (closestSegmentIdx === -1) return null;

    return {
      segmentIdx: closestSegmentIdx,
      point: { x: closestProjection.x, y: closestProjection.y },
    };
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

  // ---------- Anchor right-click ----------
  function onAnchorContextMenu(e, idx) {
    e.preventDefault();
    e.stopPropagation();

    // Dispatch actions to open context menu with point info
    dispatch(
      setClickedNode({
        id: polyline?.id,
        pointIndex: idx,
      })
    );
    dispatch(
      setAnchorPosition({
        x: e.clientX,
        y: e.clientY,
      })
    );
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

    //tempPointsRef.current = null;
    //setTempPoints(null);

    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);

    if (onPointsChange) onPointsChange(finalPoints);
    if (onChange) onChange({ ...polyline, points: finalPoints });
  }

  // Add these refs at the top of the component (around line 70)
  const toBaseFromClientRef = useRef(toBaseFromClient);
  const basePointsRef = useRef(basePoints);
  const wRef = useRef(w);
  const hRef = useRef(h);
  const closeLineRef = useRef(closeLine);

  // Update refs on every render
  useEffect(() => {
    toBaseFromClientRef.current = toBaseFromClient;
    basePointsRef.current = basePoints;
    wRef.current = w;
    hRef.current = h;
    closeLineRef.current = closeLine;
  });

  // ---------- Drawing mode: live mouse point + closing helper ----------
  useEffect(() => {
    if (!isDrawing) {
      setCurrentMousePos(null);
      setShowCloseHelper(false);
      return;
    }

    function onMove(e) {
      const currentW = wRef.current;
      const currentH = hRef.current;
      const currentBasePoints = basePointsRef.current;
      const currentCloseLine = closeLineRef.current;
      const currentToBaseFromClient = toBaseFromClientRef.current;

      const lastRel = currentBasePoints[currentBasePoints.length - 1] || null;
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

      // closing helper (distance test in base px)
      let showClose = false;
      if (currentCloseLine) {
        const firstRel = currentBasePoints[0] || null;
        const firstPx = firstRel
          ? { x: firstRel.x * currentW, y: firstRel.y * currentH }
          : null;

        if (firstPx) {
          const dx = bl.x - firstPx.x;
          const dy = bl.y - firstPx.y;
          if (Math.hypot(dx, dy) <= CLOSE_TOL_PX) {
            showClose = true;
          }
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
      const currentBasePoints = basePointsRef.current;
      if (currentBasePoints.length >= 2) {
        onComplete && onComplete(currentBasePoints);
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
  }, [isDrawing, onComplete, CLOSE_TOL_PX]);

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

  // Pattern ID for hatching
  const patternIdRef = useRef(
    `hatch-polyline-${polyline?.id ?? Math.random().toString(36).slice(2)}`
  );
  const patternId = patternIdRef.current;

  // Hatching pattern parameters
  // If showBgImage is true: compensate for containerK scaling to keep fixed world reference
  // If showBgImage is false: scale inversely to keep constant screen size
  const hatchSize = showBgImage
    ? HATCHING_SPACING / containerK
    : HATCHING_SPACING * invScale;
  const hatchStroke = showBgImage ? 1.5 / containerK : 1.5 * invScale;

  // Shared mouse move handler for tracking segment projection
  // This is attached to the parent group to ensure continuous tracking
  function handleMouseMoveForProjection(e) {
    if (isDrawing || !selected || draggingRef.current.active) {
      setSegmentProjection(null);
      return;
    }

    // Convert mouse position to base-local px
    const mousePx = toBaseFromClient(e.clientX, e.clientY);

    // Check distance to existing anchors - if too close, don't show projection
    const ANCHOR_PROXIMITY_THRESHOLD = HIT_R * invScale * 2;
    let tooCloseToAnchor = false;

    for (const p of committedRel) {
      const anchorPx = { x: p.x * w, y: p.y * h };
      const distSq =
        (mousePx.x - anchorPx.x) ** 2 + (mousePx.y - anchorPx.y) ** 2;
      if (distSq < ANCHOR_PROXIMITY_THRESHOLD ** 2) {
        tooCloseToAnchor = true;
        break;
      }
    }

    if (tooCloseToAnchor) {
      setSegmentProjection(null);
      return;
    }

    // Find closest segment and projection
    const result = findClosestSegmentAndProjection(mousePx, committedRel);

    if (result) {
      setSegmentProjection(result);
    } else {
      setSegmentProjection(null);
    }
  }

  return (
    <g {...dataProps} onMouseMove={handleMouseMoveForProjection}>
      {/* SVG definitions for hatching pattern */}
      {showFill && fillType === "HATCHING" && (
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={hatchSize}
            height={hatchSize}
          >
            <path
              d={`M 0 0 L ${hatchSize} ${hatchSize}`}
              stroke={fillColor}
              strokeWidth={hatchStroke}
            />
            {/* <path
              d={`M 0 ${hatchSize} L ${hatchSize} 0`}
              stroke={fillColor}
              strokeWidth={hatchStroke}
            /> */}
          </pattern>
        </defs>
      )}

      {/* FILLED POLYGON (preview includes moving vertex) */}
      {showFill && (
        <polygon
          points={polygonPointsStr}
          fill={fillType === "HATCHING" ? `url(#${patternId})` : fillColor}
          fillOpacity={fillOpacity ?? 0.8}
          stroke="none"
          style={{
            pointerEvents: isDrawing ? "none" : "inherit",
            ...(closeLine && !isDrawing && { cursor: "pointer" }),
          }}
          onMouseEnter={() => {
            if (!isDrawing) setHoverIdx("polygon");
          }}
          onMouseLeave={() => {
            if (!isDrawing) setHoverIdx(null);
          }}
        />
      )}

      {/* WIDE INVISIBLE OVERLAY (hover/click comfort) - RED FOR DEBUG */}
      {previewPx.length >= 2 && (
        <polyline
          points={helperPointsStr}
          fill="none"
          stroke="red"
          strokeWidth={hitStrokeWidth}
          strokeOpacity={0}
          style={{ cursor: isDrawing ? "inherit" : "pointer" }}
          onMouseEnter={() => {
            if (!isDrawing) setHoverIdx("line");
          }}
          onMouseLeave={() => {
            if (!isDrawing) {
              setHoverIdx(null);
              // Projection tracking is handled at parent level
            }
          }}
        />
      )}

      {/* VISIBLE OUTLINE */}
      {previewPx.length >= 2 && !closeLine && strokeType !== "NONE" && (
        <polyline
          points={helperPointsStr}
          fill="none"
          stroke={hoverIdx != null ? "#0066cc" : strokeProps.stroke}
          strokeWidth={strokeProps.strokeWidth}
          strokeOpacity={strokeProps.strokeOpacity}
          strokeDasharray={strokeProps.strokeDasharray}
          style={{ pointerEvents: "none" }}
        />
      )}
      {previewPx.length >= 2 && closeLine && strokeType !== "NONE" && (
        <polygon
          points={polygonPointsStr}
          fill="none"
          stroke={hoverIdx != null ? "#0066cc" : strokeProps.stroke}
          strokeWidth={strokeProps.strokeWidth}
          strokeOpacity={strokeProps.strokeOpacity}
          strokeDasharray={strokeProps.strokeDasharray}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* TEMP MOVING SEGMENTS */}
      {isDrawing &&
        currentMousePos &&
        lastCommitted &&
        strokeType !== "NONE" && (
          <line
            x1={lastCommitted.x * w}
            y1={lastCommitted.y * h}
            x2={currentMousePos.x * w}
            y2={currentMousePos.y * h}
            stroke={strokeProps.stroke}
            strokeWidth={computedStrokeWidthPx}
            strokeOpacity={strokeProps.strokeOpacity}
            strokeDasharray={strokeProps.strokeDasharray}
            opacity="0.9"
            style={{ pointerEvents: "none" }}
          />
        )}
      {isDrawing &&
        closeLine &&
        currentMousePos &&
        firstCommitted &&
        committedRel.length >= 1 &&
        strokeType !== "NONE" && (
          <line
            x1={currentMousePos.x * w}
            y1={currentMousePos.y * h}
            x2={firstCommitted.x * w}
            y2={firstCommitted.y * h}
            stroke={strokeProps.stroke}
            strokeWidth={computedStrokeWidthPx}
            strokeOpacity={strokeProps.strokeOpacity}
            strokeDasharray={strokeProps.strokeDasharray}
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
            r={HIT_R * invScale}
            fill="rgba(0,0,0,0.05)"
            stroke="#0066cc"
            strokeWidth={2 * invScale}
          />
          <circle
            cx={firstCommitted.x * w}
            cy={firstCommitted.y * h}
            r={ANCHOR_R_HOVERED * invScale}
            fill="#0066cc"
            stroke="#fff"
            strokeWidth={2 * invScale}
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
                onContextMenu={(e) => onAnchorContextMenu(e, i)}
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

      {/* POINT INSERTION INDICATOR */}
      {selected &&
        segmentProjection &&
        !isDrawing &&
        !draggingRef.current.active && (
          <g
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // Insert the point at the correct position
              const newPoints = [...committedRel];
              const insertIdx = segmentProjection.segmentIdx + 1;
              newPoints.splice(insertIdx, 0, segmentProjection.point);

              // Update the polyline
              if (onPointsChange) onPointsChange(newPoints);
              if (onChange) onChange({ ...polyline, points: newPoints });

              // Clear the projection
              setSegmentProjection(null);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={segmentProjection.point.x * w}
              cy={segmentProjection.point.y * h}
              r={HIT_R * invScale}
              fill="rgba(0,102,204,0.1)"
              stroke="#0066cc"
              strokeWidth={2 * invScale}
            />
            <circle
              cx={segmentProjection.point.x * w}
              cy={segmentProjection.point.y * h}
              r={ANCHOR_R_HOVERED * invScale}
              fill="#0066cc"
              stroke="#fff"
              strokeWidth={2 * invScale}
              style={{ pointerEvents: "none" }}
            />
          </g>
        )}
    </g>
  );
}
