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
  }, [
    // Create a dependency string that includes all point properties (x, y, type, etc.)
    polyline?.points?.map((p) => `${p.x},${p.y},${p.type ?? ""}`).join("|") ??
      "",
  ]);

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

  // Calculate control points for Bezier curve through points
  // Uses a Catmull-Rom spline approach for smooth curves
  function calculateBezierControlPoints(p0, p1, p2, tension = 0.5) {
    // Calculate tangent vectors
    const t1x = (p2.x - p0.x) * tension;
    const t1y = (p2.y - p0.y) * tension;

    // Control points for cubic Bezier
    // First control point (before p1)
    const cp1x = p0.x + t1x / 3;
    const cp1y = p0.y + t1y / 3;

    // Second control point (after p1, before p2)
    const cp2x = p1.x - t1x / 3;
    const cp2y = p1.y - t1y / 3;

    return { cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y } };
  }

  // Calculate circle passing through three points
  // Returns { center: {x, y}, r: radius } or null if points are collinear
  function circleFromThreePoints(p1, p2, p3) {
    // Check if points are collinear
    const ax = p2.x - p1.x;
    const ay = p2.y - p1.y;
    const bx = p3.x - p1.x;
    const by = p3.y - p1.y;
    const cross = ax * by - ay * bx;
    if (Math.abs(cross) < 1e-10) {
      return null; // Points are collinear
    }

    // Calculate perpendicular bisectors
    const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };

    const d1x = -ay;
    const d1y = ax;
    const d2x = -by;
    const d2y = bx;

    // Find intersection of perpendicular bisectors (circle center)
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-10) {
      return null;
    }

    const t = ((mid2.x - mid1.x) * d2y - (mid2.y - mid1.y) * d2x) / denom;
    const center = {
      x: mid1.x + t * d1x,
      y: mid1.y + t * d1y,
    };

    // Calculate radius
    const dx = p1.x - center.x;
    const dy = p1.y - center.y;
    const r = Math.hypot(dx, dy);

    return { center, r };
  }

  // Calculate angle from center to point (in radians)
  function angleFromCenter(center, point) {
    return Math.atan2(point.y - center.y, point.x - center.x);
  }

  // Build path string with Bezier curves - curve passes through all points
  // Square-type points create sharp corners, circle-type points create smooth curves
  function buildPathWithBezier(points, closeLine) {
    if (points.length < 2) return "";
    if (points.length < 3) {
      // Too few points for curves, use simple polyline
      const path = points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(" ");
      if (closeLine) return path + " Z";
      return path;
    }

    const path = [];
    path.push(`M ${points[0].x} ${points[0].y}`);

    const numPoints = points.length;
    const numSegments = closeLine ? numPoints : numPoints - 1;

    // Track which segments have been processed (for arc case)
    const processed = new Set();

    // Calculate control points for each segment to ensure curve passes through all points
    for (let i = 0; i < numSegments; i++) {
      if (processed.has(i)) continue;

      const currentIdx = i;
      const nextIdx = (i + 1) % numPoints;
      const prevIdx =
        currentIdx === 0 ? (closeLine ? numPoints - 1 : -1) : currentIdx - 1;
      const nextNextIdx =
        nextIdx === 0 ? (closeLine ? 1 : -1) : (nextIdx + 1) % numPoints;

      const p0 = points[currentIdx];
      const p1 = points[nextIdx];
      const p0Type = p0?.type;
      const p1Type = p1?.type;

      // Special edge case: p0 is square, p1 is circle, and pNext is square
      // Draw a circular arc from p0 to pNext passing through p1
      const pNextForArc = nextNextIdx >= 0 ? points[nextNextIdx] : null;
      const pNextForArcType = pNextForArc?.type;

      if (
        p0Type !== "circle" &&
        p1Type === "circle" &&
        pNextForArc &&
        pNextForArcType !== "circle"
      ) {
        // Calculate circle passing through p0, p1, pNextForArc
        const circle = circleFromThreePoints(p0, p1, pNextForArc);

        if (circle && circle.r > 0 && isFinite(circle.r)) {
          // Calculate angles for all three points in order: p0 -> p1 -> pNextForArc
          const angle0 = angleFromCenter(circle.center, p0);
          const angle1 = angleFromCenter(circle.center, p1);
          const angle2 = angleFromCenter(circle.center, pNextForArc);

          // Normalize angles to [0, 2π)
          const normalizeAngle = (a) => {
            while (a < 0) a += 2 * Math.PI;
            while (a >= 2 * Math.PI) a -= 2 * Math.PI;
            return a;
          };

          let a0 = normalizeAngle(angle0);
          let a1 = normalizeAngle(angle1);
          let a2 = normalizeAngle(angle2);

          // We need an arc from a0 to a2 that passes through a1
          // For SVG arcs: large-arc-flag determines if we use the arc > 180° (1) or <= 180° (0)
          // sweep-flag determines direction: 1 = clockwise, 0 = counter-clockwise

          // Calculate angular distances
          let cwDist = a2 - a0;
          if (cwDist < 0) cwDist += 2 * Math.PI;

          let ccwDist = a0 - a2;
          if (ccwDist < 0) ccwDist += 2 * Math.PI;

          // Helper: Check if angle test is between start and end going clockwise (accounting for wrap-around)
          const isBetweenCw = (start, end, test) => {
            if (start <= end) {
              // No wrap-around: test must be in [start, end]
              return test >= start && test <= end;
            } else {
              // Wrap-around 0: test must be >= start OR <= end
              return test >= start || test <= end;
            }
          };

          // Helper: Check if angle test is between start and end going counter-clockwise (accounting for wrap-around)
          const isBetweenCcw = (start, end, test) => {
            if (start >= end) {
              // No wrap-around: test must be in [end, start] (backwards)
              return test <= start && test >= end;
            } else {
              // Wrap-around 0: test must be <= start OR >= end
              return test <= start || test >= end;
            }
          };

          // For SVG arcs:
          // - largeArc=0 means use the arc with smaller sweep angle (≤ 180°)
          // - largeArc=1 means use the arc with larger sweep angle (> 180°)
          // - sweepFlag=1 means clockwise, sweepFlag=0 means counter-clockwise
          //
          // If cwDist <= π: clockwise is smaller, counter-clockwise is larger
          // If cwDist > π: counter-clockwise is smaller, clockwise is larger

          const a1OnCwPath = isBetweenCw(a0, a2, a1);
          const a1OnCcwPath = isBetweenCcw(a0, a2, a1);

          // Determine which arc to use
          // Note: Since all three points are on the same circle, a1 must be on exactly one of the arcs
          let largeArc, sweepFlag;

          if (a1OnCwPath && !a1OnCcwPath) {
            // a1 is ONLY on the clockwise path from a0 to a2
            sweepFlag = 1; // Clockwise
            // If cwDist <= π, clockwise is the small arc (largeArc=0)
            // If cwDist > π, clockwise is the large arc (largeArc=1)
            largeArc = cwDist > Math.PI ? 1 : 0;
          } else if (a1OnCcwPath && !a1OnCwPath) {
            // a1 is ONLY on the counter-clockwise path from a0 to a2
            sweepFlag = 0; // Counter-clockwise
            // If ccwDist <= π, counter-clockwise is the small arc (largeArc=0)
            // If ccwDist > π, counter-clockwise is the large arc (largeArc=1)
            largeArc = ccwDist > Math.PI ? 1 : 0;
          } else if (a1OnCwPath && a1OnCcwPath) {
            // Both are true - this can happen if a1 is at a0 or a2, or if all three points are collinear
            // In this case, choose the smaller arc (prefer clockwise if distances are equal)
            if (cwDist <= ccwDist) {
              sweepFlag = 1;
              largeArc = cwDist > Math.PI ? 1 : 0;
            } else {
              sweepFlag = 0;
              largeArc = ccwDist > Math.PI ? 1 : 0;
            }
          } else {
            // Neither is true - shouldn't happen, but fallback
            // Choose based on which direction gives smaller distance
            if (cwDist <= ccwDist) {
              sweepFlag = 1;
              largeArc = cwDist > Math.PI ? 1 : 0;
            } else {
              sweepFlag = 0;
              largeArc = ccwDist > Math.PI ? 1 : 0;
            }
          }

          // SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
          // The arc goes from p0 (currentPoint) to pNextForArc, passing through p1
          path.push(
            `A ${circle.r},${circle.r} 0 ${largeArc},${sweepFlag} ${pNextForArc.x},${pNextForArc.y}`
          );

          // Mark both segments as processed
          processed.add(i);
          if (nextNextIdx >= 0 && nextNextIdx < numSegments) {
            processed.add((i + 1) % numSegments);
          }
          continue;
        }
      }

      // If both points are square-type (or no type), draw a straight line
      if (p0Type !== "circle" && p1Type !== "circle") {
        path.push(`L ${p1.x} ${p1.y}`);
        continue;
      }

      // We need to draw a Bezier curve that passes through both p0 and p1
      // Control points are calculated to ensure smoothness at circle-type points

      // Get neighboring points for tangent calculation
      const pPrev = prevIdx >= 0 ? points[prevIdx] : null;
      const pNext = nextNextIdx >= 0 ? points[nextNextIdx] : null;

      // Calculate control points
      let cp1, cp2;

      // Calculate control points based on point types
      // Distance from endpoint along which control point is placed (as fraction of segment length)
      const k = 1 / 3;
      const segmentLength = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const controlDistance = segmentLength * k;

      if (p0Type === "circle" && p1Type === "circle") {
        // Both points are circle-type: smooth curve through both
        // Calculate tangent direction at p0 based on neighbors
        let t0x, t0y, t0len;
        if (pPrev && pNext) {
          // Catmull-Rom style: tangent through neighbors
          t0x = p1.x - pPrev.x;
          t0y = p1.y - pPrev.y;
        } else if (pPrev) {
          t0x = p1.x - pPrev.x;
          t0y = p1.y - pPrev.y;
        } else {
          t0x = p1.x - p0.x;
          t0y = p1.y - p0.y;
        }
        t0len = Math.hypot(t0x, t0y);
        if (t0len > 0) {
          t0x = (t0x / t0len) * controlDistance;
          t0y = (t0y / t0len) * controlDistance;
        }

        // Calculate tangent direction at p1 based on neighbors
        let t1x, t1y, t1len;
        if (pPrev && pNext) {
          t1x = pNext.x - p0.x;
          t1y = pNext.y - p0.y;
        } else if (pNext) {
          t1x = pNext.x - p0.x;
          t1y = pNext.y - p0.y;
        } else {
          t1x = p1.x - p0.x;
          t1y = p1.y - p0.y;
        }
        t1len = Math.hypot(t1x, t1y);
        if (t1len > 0) {
          t1x = (t1x / t1len) * controlDistance;
          t1y = (t1y / t1len) * controlDistance;
        }

        // Control points: cp1 departs from p0 along tangent, cp2 arrives at p1 along tangent
        cp1 = { x: p0.x + t0x, y: p0.y + t0y };
        cp2 = { x: p1.x - t1x, y: p1.y - t1y };
      } else if (p0Type === "circle" && p1Type !== "circle") {
        // p0 is circle-type, p1 is square-type: smooth at p0, sharp corner at p1
        let t0x, t0y, t0len;
        if (pPrev) {
          t0x = p1.x - pPrev.x;
          t0y = p1.y - pPrev.y;
        } else {
          t0x = p1.x - p0.x;
          t0y = p1.y - p0.y;
        }
        t0len = Math.hypot(t0x, t0y);
        if (t0len > 0) {
          t0x = (t0x / t0len) * controlDistance;
          t0y = (t0y / t0len) * controlDistance;
        }
        cp1 = { x: p0.x + t0x, y: p0.y + t0y };
        // For square corner at p1, control point points directly at p1
        cp2 = { x: p1.x - (p1.x - p0.x) * k, y: p1.y - (p1.y - p0.y) * k };
      } else if (p0Type !== "circle" && p1Type === "circle") {
        // p0 is square-type, p1 is circle-type: sharp corner at p0, smooth at p1
        let t1x, t1y, t1len;
        if (pNext) {
          t1x = pNext.x - p0.x;
          t1y = pNext.y - p0.y;
        } else {
          t1x = p1.x - p0.x;
          t1y = p1.y - p0.y;
        }
        t1len = Math.hypot(t1x, t1y);
        if (t1len > 0) {
          t1x = (t1x / t1len) * controlDistance;
          t1y = (t1y / t1len) * controlDistance;
        }
        // For square corner at p0, control point comes directly from p0
        cp1 = { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k };
        cp2 = { x: p1.x - t1x, y: p1.y - t1y };
      } else {
        // Shouldn't happen (both square), but fallback to line
        path.push(`L ${p1.x} ${p1.y}`);
        continue;
      }

      // Draw cubic Bezier curve: C cp1x,cp1y cp2x,cp2y endx,endy
      // This curve passes through p0 (start) and p1 (end)
      path.push(`C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p1.x},${p1.y}`);
    }

    if (closeLine) {
      path.push("Z");
    }

    return path.join(" ");
  }

  // Calculate point on cubic Bezier curve at parameter t (0..1)
  function bezierPoint(t, p0, cp1, cp2, p1) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
      y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y,
    };
  }

  // Project point onto circular arc
  // Returns { projection: {x, y}, t: number (0..1), distSq: number }
  function projectOntoArc(
    pointPx,
    center,
    radius,
    angleStart,
    angleEnd,
    largeArc,
    sweepFlag
  ) {
    // Normalize angles to [0, 2π)
    const normalizeAngle = (a) => {
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    };

    let aStart = normalizeAngle(angleStart);
    let aEnd = normalizeAngle(angleEnd);

    // Calculate angle from center to the point
    const anglePoint = normalizeAngle(angleFromCenter(center, pointPx));

    // Determine the actual arc range
    let arcStart, arcEnd;
    if (sweepFlag === 1) {
      // Clockwise
      if (largeArc === 1) {
        // Large arc - goes the long way around
        if (aStart <= aEnd) {
          arcStart = aEnd;
          arcEnd = aStart + 2 * Math.PI;
        } else {
          arcStart = aEnd;
          arcEnd = aStart;
        }
      } else {
        // Small arc
        if (aStart <= aEnd) {
          arcStart = aStart;
          arcEnd = aEnd;
        } else {
          arcStart = aStart;
          arcEnd = aEnd + 2 * Math.PI;
        }
      }
    } else {
      // Counter-clockwise
      if (largeArc === 1) {
        // Large arc - goes the long way around
        if (aStart >= aEnd) {
          arcStart = aEnd;
          arcEnd = aStart;
        } else {
          arcStart = aEnd;
          arcEnd = aStart - 2 * Math.PI;
        }
      } else {
        // Small arc
        if (aStart >= aEnd) {
          arcStart = aEnd;
          arcEnd = aStart;
        } else {
          arcStart = aEnd - 2 * Math.PI;
          arcEnd = aStart;
        }
      }
    }

    // Normalize arc range
    if (arcStart < 0) arcStart += 2 * Math.PI;
    if (arcEnd < 0) arcEnd += 2 * Math.PI;

    // Clamp anglePoint to arc range
    let clampedAngle = anglePoint;
    if (sweepFlag === 1) {
      // Clockwise
      if (arcStart <= arcEnd) {
        clampedAngle = Math.max(arcStart, Math.min(arcEnd, anglePoint));
      } else {
        // Wraps around
        if (anglePoint >= arcStart || anglePoint <= arcEnd) {
          clampedAngle = anglePoint;
        } else {
          // Choose closer endpoint
          const distToStart = Math.min(
            Math.abs(anglePoint - arcStart),
            2 * Math.PI - Math.abs(anglePoint - arcStart)
          );
          const distToEnd = Math.min(
            Math.abs(anglePoint - arcEnd),
            2 * Math.PI - Math.abs(anglePoint - arcEnd)
          );
          clampedAngle = distToStart < distToEnd ? arcStart : arcEnd;
        }
      }
    } else {
      // Counter-clockwise
      if (arcStart >= arcEnd) {
        clampedAngle = Math.max(arcEnd, Math.min(arcStart, anglePoint));
      } else {
        // Wraps around
        if (anglePoint <= arcStart || anglePoint >= arcEnd) {
          clampedAngle = anglePoint;
        } else {
          // Choose closer endpoint
          const distToStart = Math.min(
            Math.abs(anglePoint - arcStart),
            2 * Math.PI - Math.abs(anglePoint - arcStart)
          );
          const distToEnd = Math.min(
            Math.abs(anglePoint - arcEnd),
            2 * Math.PI - Math.abs(anglePoint - arcEnd)
          );
          clampedAngle = distToStart < distToEnd ? arcStart : arcEnd;
        }
      }
    }

    // Calculate projection point on arc
    const projection = {
      x: center.x + radius * Math.cos(clampedAngle),
      y: center.y + radius * Math.sin(clampedAngle),
    };

    // Calculate parametric position along arc (0 to 1)
    let t = 0;
    if (sweepFlag === 1) {
      if (arcStart <= arcEnd) {
        t = (clampedAngle - arcStart) / (arcEnd - arcStart);
      } else {
        const totalAngle = arcEnd + 2 * Math.PI - arcStart;
        const angleFromStart =
          clampedAngle >= arcStart
            ? clampedAngle - arcStart
            : clampedAngle + 2 * Math.PI - arcStart;
        t = angleFromStart / totalAngle;
      }
    } else {
      if (arcStart >= arcEnd) {
        t = (arcStart - clampedAngle) / (arcStart - arcEnd);
      } else {
        const totalAngle = arcStart + 2 * Math.PI - arcEnd;
        const angleFromStart =
          clampedAngle <= arcStart
            ? arcStart - clampedAngle
            : arcStart + 2 * Math.PI - clampedAngle;
        t = angleFromStart / totalAngle;
      }
    }
    t = Math.max(0, Math.min(1, t));

    const dx = pointPx.x - projection.x;
    const dy = pointPx.y - projection.y;
    const distSq = dx * dx + dy * dy;

    return { projection, t, distSq };
  }

  // Project point onto cubic Bezier curve using iterative refinement
  // Returns { projection: {x, y}, t: number (0..1), distSq: number }
  function projectOntoBezier(pointPx, p0, cp1, cp2, p1) {
    // Use binary search to find closest point
    let bestT = 0.5;
    let bestDistSq = Infinity;
    let bestPoint = null;

    // Refine by sampling at increasing resolution
    for (let iterations = 0; iterations < 10; iterations++) {
      const step = 1 / (20 + iterations * 10);
      for (let t = 0; t <= 1; t += step) {
        const pt = bezierPoint(t, p0, cp1, cp2, p1);
        const dx = pointPx.x - pt.x;
        const dy = pointPx.y - pt.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestT = t;
          bestPoint = pt;
        }
      }

      // Refine around bestT
      if (iterations < 9) {
        const refineStep = step / 2;
        for (
          let t = Math.max(0, bestT - refineStep);
          t <= Math.min(1, bestT + refineStep);
          t += refineStep / 5
        ) {
          const pt = bezierPoint(t, p0, cp1, cp2, p1);
          const dx = pointPx.x - pt.x;
          const dy = pointPx.y - pt.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestT = t;
            bestPoint = pt;
          }
        }
      }
    }

    return bestPoint
      ? { projection: bestPoint, t: bestT, distSq: bestDistSq }
      : null;
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

  // Find closest segment and projection point (handles both lines and Bezier curves)
  function findClosestSegmentAndProjection(mousePx, points) {
    if (points.length < 2) return null;

    // If we have Bezier curves, use the path to find closest point
    if (hasCirclePoints && previewPx.length >= 3) {
      const pointsWithType = previewPx.map((px, i) => ({
        ...px,
        type: previewRel[i]?.type,
      }));

      // Build mapping from path segments to original point indices
      // Account for arcs that span two segments (square-circle-square)
      const numSegments = closeLine ? points.length : points.length - 1;
      const pathSegmentToPointIdx = [];
      const processed = new Set();

      for (let i = 0; i < numSegments; i++) {
        if (processed.has(i)) continue;

        const currentIdx = i;
        const nextIdx = (i + 1) % points.length;
        const nextNextIdx =
          nextIdx === 0 ? (closeLine ? 1 : -1) : (nextIdx + 1) % points.length;
        const p0Type = pointsWithType[currentIdx]?.type;
        const p1Type = pointsWithType[nextIdx]?.type;
        const pNextForArc =
          nextNextIdx >= 0 ? pointsWithType[nextNextIdx] : null;
        const pNextForArcType = pNextForArc?.type;

        // Check for arc case: square-circle-square
        if (
          p0Type !== "circle" &&
          p1Type === "circle" &&
          pNextForArc &&
          pNextForArcType !== "circle"
        ) {
          // Arc spans from currentIdx to nextNextIdx
          pathSegmentToPointIdx.push({
            segmentIdx: pathSegmentToPointIdx.length,
            startPointIdx: currentIdx,
            endPointIdx: nextNextIdx,
            isArc: true,
          });
          processed.add(i);
          if (nextNextIdx >= 0 && nextNextIdx < numSegments) {
            processed.add((i + 1) % numSegments);
          }
        } else {
          const isBezier = p0Type === "circle" || p1Type === "circle";
          pathSegmentToPointIdx.push({
            segmentIdx: pathSegmentToPointIdx.length,
            startPointIdx: currentIdx,
            endPointIdx: nextIdx,
            isBezier,
          });
        }
      }

      // Now find closest point on the actual path
      const pathStr = buildPathWithBezier(pointsWithType, closeLine);
      let closestDistSq = Infinity;
      let closestProjection = null;
      let closestSegmentInfo = null;

      const commands = pathStr.match(/[MmLlCcAa][^MmLlCcAaZz]*/g) || [];
      let currentPoint = { x: 0, y: 0 };
      let pathSegmentIdx = -1;

      for (const cmd of commands) {
        const type = cmd[0];
        const coords = cmd
          .slice(1)
          .trim()
          .split(/[\s,]+/)
          .map(parseFloat)
          .filter((n) => !isNaN(n));

        if (type === "M" || type === "m") {
          currentPoint = { x: coords[0], y: coords[1] };
        } else if (type === "L" || type === "l") {
          pathSegmentIdx++;
          const endPoint =
            type === "L"
              ? { x: coords[0], y: coords[1] }
              : {
                  x: currentPoint.x + coords[0],
                  y: currentPoint.y + coords[1],
                };

          const proj = projectOntoSegment(mousePx, currentPoint, endPoint);
          if (proj && proj.distSq < closestDistSq) {
            closestDistSq = proj.distSq;
            closestProjection = proj.projection;
            closestSegmentInfo = pathSegmentToPointIdx[pathSegmentIdx];
          }
          currentPoint = endPoint;
        } else if (type === "C" || type === "c") {
          pathSegmentIdx++;
          const cp1 =
            type === "C"
              ? { x: coords[0], y: coords[1] }
              : {
                  x: currentPoint.x + coords[0],
                  y: currentPoint.y + coords[1],
                };
          const cp2 =
            type === "C"
              ? { x: coords[2], y: coords[3] }
              : {
                  x: currentPoint.x + coords[2],
                  y: currentPoint.y + coords[3],
                };
          const endPoint =
            type === "C"
              ? { x: coords[4], y: coords[5] }
              : {
                  x: currentPoint.x + coords[4],
                  y: currentPoint.y + coords[5],
                };

          const proj = projectOntoBezier(
            mousePx,
            currentPoint,
            cp1,
            cp2,
            endPoint
          );
          if (proj && proj.distSq < closestDistSq) {
            closestDistSq = proj.distSq;
            closestProjection = proj.projection;
            closestSegmentInfo = pathSegmentToPointIdx[pathSegmentIdx];
          }
          currentPoint = endPoint;
        } else if (type === "A" || type === "a") {
          pathSegmentIdx++;
          const rx = coords[0];
          const ry = coords[1];
          const xAxisRotation = coords[2];
          const largeArcFlag = coords[3];
          const sweepFlag = coords[4];
          const endPoint =
            type === "A"
              ? { x: coords[5], y: coords[6] }
              : {
                  x: currentPoint.x + coords[5],
                  y: currentPoint.y + coords[6],
                };

          // For circular arcs, rx === ry === radius
          // Calculate center and angles from current point and end point
          // This is a simplification - we need to reconstruct the circle from the arc parameters
          // Since we have the points in the path, we can look them up
          const segmentInfo = pathSegmentToPointIdx[pathSegmentIdx];
          if (segmentInfo && segmentInfo.isArc) {
            // Reconstruct circle from the three points
            const p0 = pointsWithType[segmentInfo.startPointIdx];
            const p1 = pointsWithType[segmentInfo.startPointIdx + 1];
            const p2 = pointsWithType[segmentInfo.endPointIdx];

            const circle = circleFromThreePoints(p0, p1, p2);
            if (circle) {
              const angleStart = angleFromCenter(circle.center, currentPoint);
              const angleEnd = angleFromCenter(circle.center, endPoint);

              const proj = projectOntoArc(
                mousePx,
                circle.center,
                circle.r,
                angleStart,
                angleEnd,
                largeArcFlag,
                sweepFlag
              );

              if (proj && proj.distSq < closestDistSq) {
                closestDistSq = proj.distSq;
                closestProjection = proj.projection;
                closestSegmentInfo = segmentInfo;
              }
            }
          }
          currentPoint = endPoint;
        }
      }

      if (closestProjection && closestSegmentInfo) {
        // Return the segment index (startPointIdx), insertion handler will add 1 to insert after start point
        return {
          segmentIdx: closestSegmentInfo.startPointIdx,
          point: { x: closestProjection.x / w, y: closestProjection.y / h },
        };
      }
    }

    // Fallback to line segment projection
    let closestSegmentIdx = -1;
    let closestProjection = null;
    let minDistSq = Infinity;

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
    // Preserve the type property when updating position
    const originalPoint = basePoints[i] || tempPointsRef.current[i];
    tempPointsRef.current[i] = {
      ...originalPoint,
      x: rx,
      y: ry,
    };
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

  // Check if any points have types that require Bezier curve rendering
  const hasCirclePoints = useMemo(() => {
    return previewRel.some((p) => p?.type === "circle");
  }, [previewRel]);

  // Build path with Bezier curves if needed
  // We need to pass both pixel points and relative points (with type info)
  const pathWithBezier = useMemo(() => {
    if (!hasCirclePoints || previewPx.length < 3) return null;
    // Create points array that has both pixel coords and type info
    const pointsWithType = previewPx.map((px, i) => ({
      ...px,
      type: previewRel[i]?.type,
    }));
    const path = buildPathWithBezier(pointsWithType, closeLine);
    return path;
  }, [hasCirclePoints, previewPx, previewRel, closeLine]);

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
      {showFill &&
        (pathWithBezier ? (
          <path
            d={pathWithBezier}
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
        ) : (
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
        ))}

      {/* WIDE INVISIBLE OVERLAY (hover/click comfort) - uses same path as visible outline */}
      {previewPx.length >= 2 &&
        (pathWithBezier ? (
          <path
            d={pathWithBezier}
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
        ) : (
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
        ))}

      {/* VISIBLE OUTLINE */}
      {previewPx.length >= 2 &&
        strokeType !== "NONE" &&
        (pathWithBezier ? (
          <path
            d={pathWithBezier}
            fill="none"
            stroke={hoverIdx != null ? "#0066cc" : strokeProps.stroke}
            strokeWidth={strokeProps.strokeWidth}
            strokeOpacity={strokeProps.strokeOpacity}
            strokeDasharray={strokeProps.strokeDasharray}
            style={{ pointerEvents: "none" }}
          />
        ) : !closeLine ? (
          <polyline
            points={helperPointsStr}
            fill="none"
            stroke={hoverIdx != null ? "#0066cc" : strokeProps.stroke}
            strokeWidth={strokeProps.strokeWidth}
            strokeOpacity={strokeProps.strokeOpacity}
            strokeDasharray={strokeProps.strokeDasharray}
            style={{ pointerEvents: "none" }}
          />
        ) : (
          <polygon
            points={polygonPointsStr}
            fill="none"
            stroke={hoverIdx != null ? "#0066cc" : strokeProps.stroke}
            strokeWidth={strokeProps.strokeWidth}
            strokeOpacity={strokeProps.strokeOpacity}
            strokeDasharray={strokeProps.strokeDasharray}
            style={{ pointerEvents: "none" }}
          />
        ))}

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
          const pointType = p?.type;
          // Default to square if no type is specified
          const isSquare = pointType !== "circle";
          const hovered =
            hoverIdx === i ||
            (draggingRef.current.active && draggingRef.current.idx === i);

          const anchorSize = (hovered ? ANCHOR_R_HOVERED : ANCHOR_R) * invScale;
          const hitRadius = HIT_R * invScale;

          return (
            <g key={`anchor-${i}`}>
              {/* Hit area (always circular for better hit detection) */}
              <circle
                cx={px}
                cy={py}
                r={hitRadius}
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
              {/* Visual indicator - square or circle based on point type */}
              {isSquare ? (
                <rect
                  x={px - anchorSize}
                  y={py - anchorSize}
                  width={anchorSize * 2}
                  height={anchorSize * 2}
                  fill={hovered ? "#0066cc" : "#ff0000"}
                  stroke="#ffffff"
                  strokeWidth={2 * invScale}
                  style={{ pointerEvents: "none" }}
                />
              ) : (
                <circle
                  cx={px}
                  cy={py}
                  r={anchorSize}
                  fill={hovered ? "#0066cc" : "#ff0000"}
                  stroke="#ffffff"
                  strokeWidth={2 * invScale}
                  style={{ pointerEvents: "none" }}
                />
              )}
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
