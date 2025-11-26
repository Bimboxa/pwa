// NodePolyline.js
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { darken } from "@mui/material/styles";
import { useSelector, useDispatch } from "react-redux";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import theme from "Styles/theme";
import applyFixedLengthConstraint from "Features/mapEditorGeneric/utils/applyFixedLengthConstraint";

import offsetPolyline from "Features/geometry/utils/offsetPolyline";

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
  edited = false,
  worldScale = 1,
  containerK = 1,
  snapHelper,
}) {
  const dispatch = useDispatch();
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);

  const isSelected = Boolean(selected);
  const isEditable = isSelected && edited;

  // Editing cut state
  const [editingCutId, setEditingCutId] = useState(null);

  const dataProps = {
    "data-node-id": polyline?.id,
    "data-node-listing-id": polyline?.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "POLYLINE",
  };

  const {
    strokeColor = theme.palette.secondary.main,
    closeLine = false,
    fillColor = theme.palette.secondary.main,
    fillOpacity = 0.8,
    fillType = "SOLID",
    strokeType = "SOLID",
    strokeOpacity = 1,
    strokeWidth = 2,
    strokeWidthUnit = "PX",
    strokeOffset,
    cuts = [], // Array of cut polylines (holes)
  } = polyline || {};

  const activeStrokeColor = isSelected
    ? theme.palette.annotation.selected
    : strokeColor;
  const hoverStrokeColor = useMemo(() => {
    try {
      return darken(activeStrokeColor, 0.2);
    } catch {
      return activeStrokeColor;
    }
  }, [activeStrokeColor]);

  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // UI
  const HIT_R = 12;
  const ANCHOR_R = 4;
  const ANCHOR_R_HOVERED = 5;
  const CLOSE_TOL_SCREEN_PX = 10; // Fixed 10px screen distance
  const HATCHING_SPACING = 12;
  const SNAP_COLOR = "#ff4dd9";

  // keep UI constant on screen
  const totalScale = showBgImage ? 1 : worldScale * containerK;
  const invScale = totalScale > 0 ? (showBgImage ? 1 : 1 / totalScale) : 1;

  // stroke width
  const hasOffset =
    strokeOffset === 1 || strokeOffset === -1 || strokeOffset === 0;
  const allowsOffsetShift = strokeOffset === 1 || strokeOffset === -1;

  const computedStrokeWidthPx = useMemo(() => {
    let widthInPx = strokeWidth;

    const fixWidth = hasOffset && (isDrawing || isEditable);
    if (fixWidth) widthInPx = 4 * invScale;

    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx;
    if (isCmUnit && !fixWidth)
      widthInPx = (widthInPx * 0.01) / baseMapMeterByPx;

    if (showBgImage) widthInPx *= invScale;

    return widthInPx;
  }, [
    strokeWidth,
    strokeWidthUnit,
    baseMapMeterByPx,
    showBgImage,
    invScale,
    strokeOffset,
    isDrawing,
    isEditable,
    hasOffset,
  ]);

  const strokeProps = useMemo(() => {
    if (strokeType === "NONE") return { stroke: "none", strokeOpacity: 0 };
    const props = {
      stroke: activeStrokeColor,
      strokeOpacity: strokeOpacity ?? 1,
      strokeWidth: computedStrokeWidthPx,
    };
    if (strokeType === "DASHED") {
      const dash = computedStrokeWidthPx * 3;
      const gap = computedStrokeWidthPx * 2;
      props.strokeDasharray = `${dash} ${gap}`;
    }
    return props;
  }, [strokeType, activeStrokeColor, strokeOpacity, computedStrokeWidthPx]);

  const hitStrokeWidth = useMemo(
    () => (showBgImage ? 10 / containerK : 10 * invScale),
    [showBgImage, containerK, invScale]
  );

  const rawPoints = polyline?.points || [];

  const applyOffset =
    !isEditable && allowsOffsetShift && Boolean(baseMapMeterByPx) && !isDrawing;

  const basePoints = useMemo(() => {
    if (!applyOffset || rawPoints.length < 2 || !w || !h) return rawPoints;

    const strokeOffsetFactor =
      typeof strokeOffset === "number" && strokeOffset !== 0 ? strokeOffset : 0;

    const pointsPx = rawPoints.map((p) => ({ x: p.x * w, y: p.y * h }));
    const offsetDistance = (computedStrokeWidthPx / 2) * strokeOffsetFactor;
    const offsetPx = offsetPolyline(pointsPx, offsetDistance, {
      isClosed: closeLine,
    });

    if (!offsetPx?.length) return rawPoints;

    return offsetPx.map((p) => ({ x: p.x / w, y: p.y / h }));
  }, [
    applyOffset,
    rawPoints,
    w,
    h,
    computedStrokeWidthPx,
    strokeOffset,
    closeLine,
  ]);

  // state
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingRef = useRef({ active: false, idx: -1, pointerId: null });
  const [segmentProjection, setSegmentProjection] = useState(null);

  const tempPointsRef = useRef(null);
  const [tempPoints, setTempPoints] = useState(null);
  const [tempCuts, setTempCuts] = useState(null);
  const rafIdRef = useRef(null);

  useLayoutEffect(() => {
    tempPointsRef.current = null;
    setTempPoints(null);
    setTempCuts(null);
  }, [
    polyline?.points?.map((p) => `${p.x},${p.y},${p.type ?? ""}`).join("|") ??
      "",
    polyline?.cuts
      ?.map((cut) =>
        cut?.points?.map((p) => `${p.x},${p.y},${p.type ?? ""}`).join(",")
      )
      .join("|") ?? "",
  ]);

  useEffect(() => {
    if (!isEditable || isDrawing || draggingRef.current.active)
      setSegmentProjection(null);
  }, [isEditable, isDrawing]);

  // drawing preview
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const nextPosRef = useRef(null);
  const moveRafRef = useRef(null);
  const [showCloseHelper, setShowCloseHelper] = useState(false);

  const scheduleTempCommit = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setTempPoints(tempPointsRef.current ? [...tempPointsRef.current] : null);
      // Update temp cuts if they exist
      if (tempPointsRef.current?.cuts) {
        setTempCuts(
          tempPointsRef.current.cuts.map((c) => ({
            ...c,
            points: c.points.map((pt) => ({ ...pt })),
          }))
        );
      } else {
        setTempCuts(null);
      }
    });
  };

  function constrainIfShift(e, ptPx, originPx) {
    if (!e.shiftKey || !originPx) return ptPx;
    const dx = ptPx.x - originPx.x;
    const dy = ptPx.y - originPx.y;
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: ptPx.x, y: originPx.y }
      : { x: originPx.x, y: ptPx.y };
  }

  // ===== Geometry helpers (SVG y-down)
  const toPx = (p) => ({ x: p.x * w, y: p.y * h });
  const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

  const angDown = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);

  function circleFromThreePoints(p0, p1, p2) {
    const x1 = p0.x,
      y1 = p0.y;
    const x2 = p1.x,
      y2 = p1.y;
    const x3 = p2.x,
      y3 = p2.y;

    // Determinant (twice the signed area of the triangle)
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

    // If the area is ~0, the points are collinear → no unique circle
    if (Math.abs(d) < 1e-9) return null;

    const x1sq_y1sq = x1 * x1 + y1 * y1;
    const x2sq_y2sq = x2 * x2 + y2 * y2;
    const x3sq_y3sq = x3 * x3 + y3 * y3;

    const ux =
      (x1sq_y1sq * (y2 - y3) + x2sq_y2sq * (y3 - y1) + x3sq_y3sq * (y1 - y2)) /
      d;

    const uy =
      (x1sq_y1sq * (x3 - x2) + x2sq_y2sq * (x1 - x3) + x3sq_y3sq * (x2 - x1)) /
      d;

    const center = { x: ux, y: uy };
    const r = Math.hypot(x1 - ux, y1 - uy); // distance from center to any point

    return { center, r };
  }

  // ----- Path builder (includes the fixed S–C–S arc logic)
  function buildPathAndMap(relPoints, close, cuts = []) {
    const res = { d: "", segmentMap: [] };
    if (!relPoints?.length) return res;

    // ---------- small helpers -------------------------------------------------

    const TWO_PI = Math.PI * 2;

    function normAngle(a) {
      a = a % TWO_PI;
      if (a < 0) a += TWO_PI;
      return a;
    }

    // CCW angular distance from aStart to aEnd in (0, 2π]
    function ccwDelta(aStart, aEnd) {
      const s = normAngle(aStart);
      const e = normAngle(aEnd);
      let d = e - s;
      if (d <= 0) d += TWO_PI;
      return d;
    }

    // True if angle aMid lies strictly between a0 and a2 when moving CCW
    // from a0 to a2 on the circle.
    function isBetweenCCW(a0, a1, a2) {
      const d02 = ccwDelta(a0, a2);
      const d01 = ccwDelta(a0, a1);
      return d01 > 1e-6 && d01 < d02 - 1e-6;
    }

    /**
     * Compute the center of the circle for a given SVG arc, assuming:
     *   - rx = ry = r
     *   - x-axis rotation = 0
     * This is a simplified version of the SVG spec formulas.
     *
     * fa = large-arc-flag (0 | 1)
     * fs = sweep-flag     (0 | 1)
     */
    function svgArcCenterForFlags(P0, P1, r, fa, fs) {
      const x1 = P0.x;
      const y1 = P0.y;
      const x2 = P1.x;
      const y2 = P1.y;

      // Step 1: transform into midpoint coordinates
      const dx2 = (x1 - x2) / 2;
      const dy2 = (y1 - y2) / 2;
      const x1p = dx2; // because rotation = 0
      const y1p = dy2;

      const r2 = r * r;
      const x1p2 = x1p * x1p;
      const y1p2 = y1p * y1p;
      const d = x1p2 + y1p2;

      if (d === 0) {
        return null; // start = end
      }

      // Ensure radius large enough – we assume r is valid (from the true circle),
      // but guard against tiny numeric issues.
      if (d > r2) {
        // radii too small, SVG would scale them up;
        // here we just say "no valid center" for this combo.
        return null;
      }

      // From SVG spec (simplified for rx = ry = r, φ = 0):
      // sign = (fa == fs ? -1 : 1)
      // * sqrt( (r^2 - d) / d )
      const num = r2 - d;
      const den = d;
      if (den === 0) return null;

      let factor = Math.sqrt(Math.max(0, num / den));
      const paritySign = fa === fs ? -1 : 1;
      factor *= paritySign;

      const cxp = factor * y1p;
      const cyp = factor * -x1p;

      // Transform back to original coordinates
      const cx = cxp + (x1 + x2) / 2;
      const cy = cyp + (y1 + y2) / 2;

      return { x: cx, y: cy };
    }

    // ---------- prepare points & types ---------------------------------------

    const pts = relPoints.map(toPx); // [{ x, y }, ...]
    const types = relPoints.map(typeOf); // ["square" | "circle", ...]
    const n = pts.length;

    const dParts = [`M ${pts[0].x} ${pts[0].y}`];

    if (n === 1) {
      res.d = dParts.join(" ");
      return res;
    }

    const idx = (i) => (close ? (i + n) % n : i);
    const limit = close ? n : n - 1;

    // ---------- main loop ----------------------------------------------------

    let i = 0;
    while (i < limit) {
      const i0 = idx(i);
      const i1 = idx(i + 1);
      const t0 = types[i0];
      const t1 = types[i1];

      // Special branch: square → circle
      if (t0 === "square" && t1 === "circle") {
        // Find the next square after one or more circle points
        let j = i + 1;
        while (j < i + n && types[idx(j)] === "circle") j += 1;
        const i2 = idx(j);

        if (!close && j >= n) {
          // Open path: ran off the end, just draw a line to the first circle
          const P1 = pts[i1];
          dParts.push(`L ${P1.x} ${P1.y}`);
          res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1 });
          i += 1;
          continue;
        }

        // Exact S–C–S : 3 points: P0 (square), P1 (circle), P2 (square)
        // Check if we have exactly one circle between two squares
        // i1 is already the circle point (from line 340), i2 is the next square found
        const i2_expected = idx(i + 2);
        const isExactSCS =
          j === i + 2 && types[i1] === "circle" && types[i2] === "square";

        if (isExactSCS) {
          const P0 = pts[i0];
          const P1 = pts[i1];
          const P2 = pts[i2];

          const circ = circleFromThreePoints(P0, P1, P2);

          if (!circ || !Number.isFinite(circ.r) || circ.r <= 0) {
            // Degenerate case: straight lines
            dParts.push(`L ${P1.x} ${P1.y}`);
            dParts.push(`L ${P2.x} ${P2.y}`);
            res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1 });
            res.segmentMap.push({ startPointIdx: i1, endPointIdx: i2 });
          } else {
            const { center: C, r } = circ;

            // 1. Determine Winding Order (CW vs CCW)
            // Cross product of vectors (P0->P1) and (P0->P2)
            // In SVG (y-down): Cross > 0 is Clockwise, Cross < 0 is Counter-Clockwise
            const cross =
              (P1.x - P0.x) * (P2.y - P0.y) - (P1.y - P0.y) * (P2.x - P0.x);
            const isCW = cross > 0;
            const sweep = isCW ? 1 : 0;

            // 2. Helper to calculate angular distance and Large Arc Flag
            // We calculate exact angles to ensure flags are perfect
            const getLargeArcFlag = (pStart, pEnd) => {
              const aStart = angDown(C, pStart);
              const aEnd = angDown(C, pEnd);

              // Calculate raw difference
              let diff = aEnd - aStart;
              const TWO_PI = Math.PI * 2;

              // Normalize diff based on desired direction (sweep)
              if (isCW) {
                // We need a positive angle delta (0 to 2PI)
                while (diff < 0) diff += TWO_PI;
                while (diff >= TWO_PI) diff -= TWO_PI;
              } else {
                // We need a negative angle delta (0 to -2PI)
                while (diff > 0) diff -= TWO_PI;
                while (diff <= -TWO_PI) diff += TWO_PI;
              }

              // If the absolute angular travel is > PI, it's a large arc
              return Math.abs(diff) > Math.PI ? 1 : 0;
            };

            const large01 = getLargeArcFlag(P0, P1);
            const large12 = getLargeArcFlag(P1, P2);

            // 3. THE FIX: Pad the radius slightly!
            // If 'r' is barely too small due to float rounding, SVG scales it up
            // and moves the center to the midpoint, causing the kink.
            // Multiplier 1.0005 ensures the radius is definitely valid for the points.
            const rSafe = r * 1.0005;

            dParts.push(
              `A ${rSafe} ${rSafe} 0 ${large01} ${sweep} ${P1.x} ${P1.y}`
            );
            dParts.push(
              `A ${rSafe} ${rSafe} 0 ${large12} ${sweep} ${P2.x} ${P2.y}`
            );

            const arcGroupId = `${i0}-${i2}`;
            res.segmentMap.push({
              startPointIdx: i0,
              endPointIdx: i1,
              isArc: true,
              arcGroupId,
              arcCenter: { x: C.x / w, y: C.y / h }, // Store center in relative coords
              arcRadius: rSafe / w, // Store radius normalized by width
            });
            res.segmentMap.push({
              startPointIdx: i1,
              endPointIdx: i2,
              isArc: true,
              arcGroupId,
              arcCenter: { x: C.x / w, y: C.y / h }, // Store center in relative coords
              arcRadius: rSafe / w, // Store radius normalized by width
            });
          }

          i += 2; // consumed S–C–S
          continue;
        }

        // Generic case: S–C–…–C–S with > 1 circle in between → cubic smoothing
        let k = i;
        dParts.push(`L ${pts[i0].x} ${pts[i0].y}`);

        while (k < i2) {
          const p0 = pts[idx(k)];
          const p1 = pts[idx(k + 1)];

          const cp1 = {
            x: p0.x + (p1.x - p0.x) / 3,
            y: p0.y + (p1.y - p0.y) / 3,
          };
          const cp2 = {
            x: p1.x - (p1.x - p0.x) / 3,
            y: p1.y - (p1.y - p0.y) / 3,
          };

          dParts.push(`C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p1.x} ${p1.y}`);
          res.segmentMap.push({
            startPointIdx: idx(k),
            endPointIdx: idx(k + 1),
          });

          k += 1;
        }

        i = i2;
        continue;
      }

      // Default: straight line from pts[i0] to pts[i1]
      const P1 = pts[i1];
      dParts.push(`L ${P1.x} ${P1.y}`);
      res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1 });
      i += 1;
    }

    if (close) dParts.push("Z");

    // Build paths for cuts (holes)
    const cutPaths = [];
    if (cuts && Array.isArray(cuts) && cuts.length > 0) {
      cuts.forEach((cut) => {
        if (!cut || !Array.isArray(cut.points) || cut.points.length < 2) return;
        const cutRelPoints = cut.points || [];
        const cutPts = cutRelPoints.map(toPx);
        const cutTypes = cutRelPoints.map(typeOf);
        const cutN = cutPts.length;

        const cutDParts = [`M ${cutPts[0].x} ${cutPts[0].y}`];
        if (cutN === 1) {
          return; // Skip single-point cuts
        }

        const cutIdx = (i) => (cut.closeLine !== false ? (i + cutN) % cutN : i);
        const cutLimit = cut.closeLine !== false ? cutN : cutN - 1;

        let cutI = 0;
        while (cutI < cutLimit) {
          const cutI0 = cutIdx(cutI);
          const cutI1 = cutIdx(cutI + 1);
          const cutT0 = cutTypes[cutI0];
          const cutT1 = cutTypes[cutI1];

          // Handle S-C-S pattern in cuts (same logic as main path)
          if (cutT0 === "square" && cutT1 === "circle") {
            let cutJ = cutI + 1;
            while (cutJ < cutI + cutN && cutTypes[cutIdx(cutJ)] === "circle")
              cutJ += 1;
            const cutI2 = cutIdx(cutJ);

            if (cut.closeLine === false && cutJ >= cutN) {
              const cutP1 = cutPts[cutI1];
              cutDParts.push(`L ${cutP1.x} ${cutP1.y}`);
              cutI += 1;
              continue;
            }

            if (cutJ === cutI + 2 && cutTypes[cutI2] === "square") {
              const cutP0 = cutPts[cutI0];
              const cutP1 = cutPts[cutI1];
              const cutP2 = cutPts[cutI2];

              const cutCirc = circleFromThreePoints(cutP0, cutP1, cutP2);

              if (cutCirc && Number.isFinite(cutCirc.r) && cutCirc.r > 0) {
                const cutCross =
                  (cutP1.x - cutP0.x) * (cutP2.y - cutP0.y) -
                  (cutP1.y - cutP0.y) * (cutP2.x - cutP0.x);
                const cutIsCW = cutCross > 0;
                const cutSweep = cutIsCW ? 1 : 0;

                const getCutLargeArcFlag = (pStart, pEnd) => {
                  const aStart = angDown(cutCirc.center, pStart);
                  const aEnd = angDown(cutCirc.center, pEnd);
                  let diff = aEnd - aStart;
                  const TWO_PI = Math.PI * 2;

                  if (cutIsCW) {
                    while (diff < 0) diff += TWO_PI;
                    while (diff >= TWO_PI) diff -= TWO_PI;
                  } else {
                    while (diff > 0) diff -= TWO_PI;
                    while (diff <= -TWO_PI) diff += TWO_PI;
                  }

                  return Math.abs(diff) > Math.PI ? 1 : 0;
                };

                const cutLarge01 = getCutLargeArcFlag(cutP0, cutP1);
                const cutLarge12 = getCutLargeArcFlag(cutP1, cutP2);
                const cutRSafe = cutCirc.r * 1.0005;

                cutDParts.push(
                  `A ${cutRSafe} ${cutRSafe} 0 ${cutLarge01} ${cutSweep} ${cutP1.x} ${cutP1.y}`
                );
                cutDParts.push(
                  `A ${cutRSafe} ${cutRSafe} 0 ${cutLarge12} ${cutSweep} ${cutP2.x} ${cutP2.y}`
                );

                cutI += 2;
                continue;
              } else {
                cutDParts.push(`L ${cutP1.x} ${cutP1.y}`);
                cutDParts.push(`L ${cutP2.x} ${cutP2.y}`);
                cutI += 2;
                continue;
              }
            }

            let cutK = cutI;
            while (cutK < cutJ) {
              const cutPk0 = cutPts[cutIdx(cutK)];
              const cutPk1 = cutPts[cutIdx(cutK + 1)];
              const cutCp1 = {
                x: cutPk0.x + (cutPk1.x - cutPk0.x) / 3,
                y: cutPk0.y + (cutPk1.y - cutPk0.y) / 3,
              };
              const cutCp2 = {
                x: cutPk1.x - (cutPk1.x - cutPk0.x) / 3,
                y: cutPk1.y - (cutPk1.y - cutPk0.y) / 3,
              };
              cutDParts.push(
                `C ${cutCp1.x} ${cutCp1.y} ${cutCp2.x} ${cutCp2.y} ${cutPk1.x} ${cutPk1.y}`
              );
              cutK += 1;
            }
            cutI = cutJ;
            continue;
          }

          const cutP1 = cutPts[cutI1];
          cutDParts.push(`L ${cutP1.x} ${cutP1.y}`);
          cutI += 1;
        }

        if (cut.closeLine !== false) cutDParts.push("Z");
        cutPaths.push(cutDParts.join(" "));
      });
    }

    // Combine main path with cut paths
    res.d = [dParts.join(" "), ...cutPaths].join(" ");
    return res;
  }

  // projection helpers
  function projectOntoSegment(pointPx, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return null;
    const t = Math.max(
      0,
      Math.min(1, ((pointPx.x - a.x) * dx + (pointPx.y - a.y) * dy) / len2)
    );
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    const d2 = (pointPx.x - proj.x) ** 2 + (pointPx.y - proj.y) ** 2;
    return { projection: proj, t, distSq: d2 };
  }

  // Project a point onto a circular arc by sampling points along the actual arc
  function projectOntoArc(
    pointPx,
    startPx,
    endPx,
    centerPx,
    radiusPx,
    largeArcFlag,
    sweepFlag
  ) {
    // Calculate angles from center to start and end points
    const angleStart = Math.atan2(
      startPx.y - centerPx.y,
      startPx.x - centerPx.x
    );
    const angleEnd = Math.atan2(endPx.y - centerPx.y, endPx.x - centerPx.x);

    const TWO_PI = Math.PI * 2;

    // Normalize angles to [0, 2π)
    const normalizeAngle = (a) => {
      let normalized = a;
      while (normalized < 0) normalized += TWO_PI;
      while (normalized >= TWO_PI) normalized -= TWO_PI;
      return normalized;
    };

    let normStart = normalizeAngle(angleStart);
    let normEnd = normalizeAngle(angleEnd);

    // Calculate angular span
    let angleSpan;
    if (sweepFlag === 1) {
      // Clockwise
      angleSpan =
        normEnd >= normStart
          ? normEnd - normStart
          : normEnd - normStart + TWO_PI;
    } else {
      // Counter-clockwise
      angleSpan =
        normStart >= normEnd
          ? normStart - normEnd
          : normStart - normEnd + TWO_PI;
    }

    // Adjust for large arc flag
    if (largeArcFlag === 1 && angleSpan < Math.PI) {
      angleSpan = TWO_PI - angleSpan;
    } else if (largeArcFlag === 0 && angleSpan > Math.PI) {
      angleSpan = TWO_PI - angleSpan;
    }

    // Sample points along the actual arc and find the closest one
    let bestLocal = { d2: Infinity, pt: null };
    const numSamples = 100; // More samples for better accuracy

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      let angle;

      if (sweepFlag === 1) {
        // Clockwise from start
        angle = normStart + t * angleSpan;
        if (angle >= TWO_PI) angle -= TWO_PI;
      } else {
        // Counter-clockwise from start
        angle = normStart - t * angleSpan;
        if (angle < 0) angle += TWO_PI;
      }

      const p = {
        x: centerPx.x + radiusPx * Math.cos(angle),
        y: centerPx.y + radiusPx * Math.sin(angle),
      };

      const d2 = (pointPx.x - p.x) ** 2 + (pointPx.y - p.y) ** 2;
      if (d2 < bestLocal.d2) {
        bestLocal = { d2, pt: p };
      }
    }

    if (bestLocal.pt) {
      return { projection: bestLocal.pt, distSq: bestLocal.d2 };
    }

    // Fallback to start point
    const d2 = (pointPx.x - startPx.x) ** 2 + (pointPx.y - startPx.y) ** 2;
    return { projection: startPx, distSq: d2 };
  }

  // dragging
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
  function onAnchorContextMenu(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    dispatch(setClickedNode({ id: polyline?.id, pointIndex: idx }));
    dispatch(setAnchorPosition({ x: e.clientX, y: e.clientY }));
  }
  function onDocPointerMove(e) {
    if (!draggingRef.current.active) return;
    const i = draggingRef.current.idx;
    const cutId = draggingRef.current.cutId;

    // Handle cut editing
    if (cutId) {
      // Get cuts from temp storage if editing, otherwise use actual cuts
      const currentCuts = tempPointsRef.current?.cuts || cuts;
      const cut = currentCuts.find((c) => c.id === cutId);
      if (!cut || !Array.isArray(cut.points)) return;

      const cutPoints = cut.points.map((p) => ({ x: p.x * w, y: p.y * h }));
      const prev = cutPoints[i - 1] ?? null;
      const next = cutPoints[i + 1] ?? null;
      const refRel = prev || next || null;
      const refPx = refRel ? { x: refRel.x, y: refRel.y } : null;

      let bl = toBaseFromClient(e.clientX, e.clientY);
      bl = constrainIfShift(e, bl, refPx);

      const rx = Math.max(0, Math.min(1, bl.x / w));
      const ry = Math.max(0, Math.min(1, bl.y / h));

      // Update cut points in temp storage
      if (!tempPointsRef.current) {
        tempPointsRef.current = basePoints.map((p) => ({ ...p }));
      }
      if (!tempPointsRef.current.cuts) {
        tempPointsRef.current.cuts = cuts.map((c) => ({
          ...c,
          points: c.points.map((pt) => ({ ...pt })),
        }));
        setTempCuts(tempPointsRef.current.cuts);
      }

      const cutToEdit = tempPointsRef.current.cuts.find((c) => c.id === cutId);
      if (cutToEdit) {
        const original = cut.points[i] || cutToEdit.points[i];
        cutToEdit.points[i] = { ...original, x: rx, y: ry };
        scheduleTempCommit();
      }

      e.preventDefault();
      return;
    }

    // Handle main polyline editing (existing logic)
    const prev = basePoints[i - 1] ?? null;
    const next = basePoints[i + 1] ?? null;
    const refRel = prev || next || null;
    const refPx = refRel ? { x: refRel.x * w, y: refRel.y * h } : null;

    let bl = toBaseFromClient(e.clientX, e.clientY);
    bl = constrainIfShift(e, bl, refPx);

    const rx = Math.max(0, Math.min(1, bl.x / w));
    const ry = Math.max(0, Math.min(1, bl.y / h));

    if (!tempPointsRef.current)
      tempPointsRef.current = basePoints.map((p) => ({ ...p }));
    const original = basePoints[i] || tempPointsRef.current[i];
    tempPointsRef.current[i] = { ...original, x: rx, y: ry };
    scheduleTempCommit();
    e.preventDefault();
  }
  function onDocPointerUp() {
    if (!draggingRef.current.active) return;
    const cutId = draggingRef.current.cutId;
    draggingRef.current.active = false;

    // Handle cut editing
    if (cutId && tempPointsRef.current?.cuts) {
      const updatedCuts = tempPointsRef.current.cuts.map((c) => ({
        ...c,
        points: c.points.map((pt) => ({ ...pt })),
      }));

      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);

      // Update the annotation with new cuts
      onChange && onChange({ ...polyline, cuts: updatedCuts });

      // Clear temp state
      if (tempPointsRef.current) {
        tempPointsRef.current.cuts = null;
      }
      setTempCuts(null);
      draggingRef.current = { active: false, idx: -1, pointerId: null };
      return;
    }

    // Handle main polyline editing (existing logic)
    const finalPoints = (tempPointsRef.current ?? basePoints).map((p) => ({
      ...p,
    }));
    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);
    onPointsChange && onPointsChange(finalPoints);
    onChange && onChange({ ...polyline, points: finalPoints });
  }

  // drawing-mode refs
  const toBaseFromClientRef = useRef(toBaseFromClient);
  const basePointsRef = useRef(basePoints);
  const wRef = useRef(w);
  const hRef = useRef(h);
  const closeLineRef = useRef(closeLine);
  const containerKRef = useRef(containerK);
  const worldScaleRef = useRef(worldScale);
  const showBgImageRef = useRef(showBgImage);
  const onCompleteRef = useRef(onComplete);
  const fixedLengthRef = useRef(fixedLength);
  const meterByPxRef = useRef(baseMapMeterByPx);
  useEffect(() => {
    toBaseFromClientRef.current = toBaseFromClient;
    basePointsRef.current = basePoints;
    wRef.current = w;
    hRef.current = h;
    closeLineRef.current = closeLine;
    containerKRef.current = containerK;
    worldScaleRef.current = worldScale;
    showBgImageRef.current = showBgImage;
    onCompleteRef.current = onComplete;
    fixedLengthRef.current = fixedLength;
    meterByPxRef.current = baseMapMeterByPx;
  });

  // drawing preview / close helper
  useEffect(() => {
    if (!isDrawing) {
      setCurrentMousePos(null);
      setShowCloseHelper(false);
      return;
    }
    function onMove(e) {
      const W = wRef.current,
        H = hRef.current;
      const pts = basePointsRef.current;
      const isClosed = closeLineRef.current;
      const tbf = toBaseFromClientRef.current;

      const lastRel = pts[pts.length - 1] || null;
      const lastPx = lastRel ? { x: lastRel.x * W, y: lastRel.y * H } : null;

      let bl = tbf(e.clientX, e.clientY);
      bl = constrainIfShift(e, bl, lastPx);

      const constrainedWithFixedLength = applyFixedLengthConstraint({
        lastPointPx: lastPx,
        candidatePointPx: bl,
        fixedLengthMeters: fixedLengthRef.current,
        meterPerPixel: meterByPxRef.current,
      });

      bl = constrainedWithFixedLength || bl;

      let rx = bl.x / W;
      let ry = bl.y / H;

      let showClose = false;
      if (isClosed) {
        const firstRel = pts[0] || null;
        const firstPx = firstRel
          ? { x: firstRel.x * W, y: firstRel.y * H }
          : null;
        if (firstPx) {
          // Calculate distance in base-local px
          const distBaseLocal = Math.hypot(bl.x - firstPx.x, bl.y - firstPx.y);
          // Convert screen threshold (10px) to base-local px
          // Scale from base-local to screen: showBgImage ? containerK : worldScale * containerK
          const screenScale = showBgImageRef.current
            ? containerKRef.current
            : worldScaleRef.current * containerKRef.current;
          const thresholdBaseLocal = CLOSE_TOL_SCREEN_PX / screenScale;
          if (distBaseLocal <= thresholdBaseLocal) {
            showClose = true;
          }
        }
      }

      if (snapHelper && !showClose) {
        const { relX, relY } = snapHelper;
        rx = relX;
        ry = relY;
      }

      nextPosRef.current = { x: rx, y: ry, showClose };

      if (!moveRafRef.current) {
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
      const pts = basePointsRef.current;
      if (pts.length >= 2) {
        onComplete && onComplete(pts);
        setCurrentMousePos(null);
        setShowCloseHelper(false);
      }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("dblclick", onDblClick);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("dblclick", onDblClick);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    };
  }, [isDrawing, onComplete]);

  const committedRel = useMemo(
    () => tempPoints ?? basePoints,
    [tempPoints, basePoints]
  );
  const previewRel = useMemo(
    () =>
      isDrawing && currentMousePos && committedRel.length > 0
        ? [...committedRel, currentMousePos]
        : committedRel,
    [isDrawing, currentMousePos, committedRel]
  );

  const committedPx = useMemo(
    () => committedRel.map((p) => ({ x: p.x * w, y: p.y * h })),
    [committedRel, w, h]
  );

  const previewPx = useMemo(
    () => previewRel.map((p) => ({ x: p.x * w, y: p.y * h })),
    [previewRel, w, h]
  );

  const currentMousePosPx = useMemo(() => {
    if (!currentMousePos) return null;
    return { x: currentMousePos.x * w, y: currentMousePos.y * h };
  }, [currentMousePos, w, h]);

  const segmentProjectionPx = useMemo(() => {
    if (!segmentProjection) return null;
    return {
      ...segmentProjection,
      point: {
        x: segmentProjection.point.x * w,
        y: segmentProjection.point.y * h,
      },
    };
  }, [segmentProjection, w, h]);

  // Use temp cuts if editing, otherwise use actual cuts
  const activeCuts = tempCuts ?? cuts;

  const { d: pathD, segmentMap } = useMemo(
    () => buildPathAndMap(previewRel, closeLine, activeCuts),
    [previewRel, closeLine, activeCuts]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);
    };
  }, []);

  const showFill = closeLine && previewRel.length >= 3;

  // hatching
  const patternIdRef = useRef(
    `hatch-polyline-${polyline?.id ?? Math.random().toString(36).slice(2)}`
  );
  const patternId = patternIdRef.current;
  const hatchSize = showBgImage
    ? HATCHING_SPACING / containerK
    : HATCHING_SPACING * invScale;
  const hatchStroke = showBgImage ? 1.5 / containerK : 1.5 * invScale;

  // projection for insertion (approx; treat path as lines/cubics/arcs)
  function findClosestSegmentAndProjection(mousePx) {
    if (previewRel.length < 2) return null;
    const cmds = pathD.match(/[MmLlCcAa][^MmLlCcAaZz]*/g) || [];
    let current = { x: 0, y: 0 };
    let segIdx = -1;
    let best = { d2: Infinity, proj: null, segIdx: -1 };

    for (const cmd of cmds) {
      const t = cmd[0];
      const nums = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter((n) => !isNaN(n));
      if (t === "M") {
        current = { x: nums[0], y: nums[1] };
      } else if (t === "L") {
        segIdx++;
        const end = { x: nums[0], y: nums[1] };
        const proj = projectOntoSegment(mousePx, current, end);
        if (proj && proj.distSq < best.d2) {
          best = { d2: proj.distSq, proj: proj.projection, segIdx };
        }
        current = end;
      } else if (t === "C") {
        segIdx++;
        const cp1 = { x: nums[0], y: nums[1] };
        const cp2 = { x: nums[2], y: nums[3] };
        const end = { x: nums[4], y: nums[5] };
        const B = (tt, p0, c1, c2, p1) => {
          const mt = 1 - tt,
            mt2 = mt * mt,
            mt3 = mt2 * mt,
            t2 = tt * tt,
            t3 = t2 * tt;
          return {
            x:
              mt3 * p0.x + 3 * mt2 * tt * c1.x + 3 * mt * t2 * c2.x + t3 * p1.x,
            y:
              mt3 * p0.y + 3 * mt2 * tt * c1.y + 3 * mt * t2 * c2.y + t3 * p1.y,
          };
        };
        let bestLocal = { d2: Infinity, pt: null };
        for (let tt = 0; tt <= 1; tt += 1 / 60) {
          const p = B(tt, current, cp1, cp2, end);
          const d2 = (mousePx.x - p.x) ** 2 + (mousePx.y - p.y) ** 2;
          if (d2 < bestLocal.d2) bestLocal = { d2, pt: p };
        }
        if (bestLocal.pt && bestLocal.d2 < best.d2) {
          best = { d2: bestLocal.d2, proj: bestLocal.pt, segIdx };
        }
        current = end;
      } else if (t === "A") {
        // Arc command - use proper arc projection
        segIdx++;
        const rx = nums[0];
        const ry = nums[1];
        const xAxisRotation = nums[2];
        const largeArcFlag = nums[3];
        const sweepFlag = nums[4];
        const end = { x: nums[5], y: nums[6] };

        // Check if this segment has arc information in segmentMap
        const segmentInfo = segmentMap[segIdx];
        if (
          segmentInfo?.isArc &&
          segmentInfo?.arcCenter &&
          segmentInfo?.arcRadius
        ) {
          // Convert stored relative coordinates to pixel coordinates
          const centerPx = {
            x: segmentInfo.arcCenter.x * w,
            y: segmentInfo.arcCenter.y * h,
          };
          const radiusPx = segmentInfo.arcRadius * w;

          // Project onto the arc
          const proj = projectOntoArc(
            mousePx,
            current,
            end,
            centerPx,
            radiusPx,
            largeArcFlag,
            sweepFlag
          );

          if (proj && proj.distSq < best.d2) {
            best = { d2: proj.distSq, proj: proj.projection, segIdx };
          }
        } else {
          // Fallback: sample arc points for projection (if arc info not available)
          let bestLocal = { d2: Infinity, pt: null };
          for (let tt = 0; tt <= 1; tt += 0.01) {
            // Linear interpolation as approximation
            const p = {
              x: current.x + (end.x - current.x) * tt,
              y: current.y + (end.y - current.y) * tt,
            };
            const d2 = (mousePx.x - p.x) ** 2 + (mousePx.y - p.y) ** 2;
            if (d2 < bestLocal.d2) bestLocal = { d2, pt: p };
          }
          if (bestLocal.pt && bestLocal.d2 < best.d2) {
            best = { d2: bestLocal.d2, proj: bestLocal.pt, segIdx };
          }
        }
        current = end;
      }
    }

    if (best.proj && best.segIdx >= 0 && segmentMap[best.segIdx]) {
      const segmentInfo = segmentMap[best.segIdx];
      // Insert after the start point of the segment
      return {
        segmentIdx: segmentInfo.startPointIdx,
        point: { x: best.proj.x / w, y: best.proj.y / h },
      };
    }
    return null;
  }

  function handleMouseMoveForProjection(e) {
    if (isDrawing || !isEditable || draggingRef.current.active) {
      setSegmentProjection(null);
      return;
    }
    const mousePx = toBaseFromClient(e.clientX, e.clientY);
    const threshold = HIT_R * invScale * 2;
    for (const p of committedRel) {
      const ap = { x: p.x * w, y: p.y * h };
      const d2 = (mousePx.x - ap.x) ** 2 + (mousePx.y - ap.y) ** 2;
      if (d2 < threshold ** 2) {
        setSegmentProjection(null);
        return;
      }
    }
    const resProj = findClosestSegmentAndProjection(mousePx);
    setSegmentProjection(resProj || null);
  }

  // ---- render
  return (
    <g {...dataProps} onMouseMove={handleMouseMoveForProjection}>
      {/* hatching */}
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
          </pattern>
        </defs>
      )}

      {/* FILL */}
      {closeLine && previewRel.length >= 3 && (
        <path
          d={pathD}
          fill={fillType === "HATCHING" ? `url(#${patternId})` : fillColor}
          fillOpacity={fillOpacity ?? 0.8}
          fillRule={cuts && cuts.length > 0 ? "evenodd" : "nonzero"}
          stroke="none"
          style={{
            pointerEvents: isDrawing ? "none" : "inherit",
            ...(closeLine && !isDrawing && { cursor: "pointer" }),
          }}
          onMouseEnter={() => !isDrawing && setHoverIdx("polygon")}
          onMouseLeave={() => !isDrawing && setHoverIdx(null)}
        />
      )}

      {/* INVISIBLE HOVER OVERLAY */}
      {previewPx.length >= 2 && (
        <path
          d={pathD}
          fill="none"
          stroke="red"
          strokeWidth={hitStrokeWidth}
          strokeOpacity={0}
          style={{ cursor: isDrawing ? "inherit" : "pointer" }}
          onMouseEnter={() => !isDrawing && setHoverIdx("line")}
          onMouseLeave={() => !isDrawing && setHoverIdx(null)}
        />
      )}

      {/* OUTLINE */}
      {previewPx.length >= 2 && strokeType !== "NONE" && (
        <path
          d={pathD}
          fill="none"
          stroke={hoverIdx != null ? hoverStrokeColor : strokeProps.stroke}
          strokeWidth={strokeProps.strokeWidth}
          strokeOpacity={strokeProps.strokeOpacity}
          strokeDasharray={strokeProps.strokeDasharray}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* TEMP DRAW SEGMENTS */}
      {isDrawing &&
        currentMousePos &&
        committedRel.length > 0 &&
        strokeType !== "NONE" && (
          <line
            x1={committedPx[committedPx.length - 1]?.x}
            y1={committedPx[committedPx.length - 1]?.y}
            x2={currentMousePosPx?.x}
            y2={currentMousePosPx?.y}
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
        committedRel.length >= 1 &&
        strokeType !== "NONE" && (
          <line
            x1={currentMousePosPx?.x}
            y1={currentMousePosPx?.y}
            x2={committedPx[0]?.x}
            y2={committedPx[0]?.y}
            stroke={strokeProps.stroke}
            strokeWidth={computedStrokeWidthPx}
            strokeOpacity={strokeProps.strokeOpacity}
            strokeDasharray={strokeProps.strokeDasharray}
            opacity="0.9"
            style={{ pointerEvents: "none" }}
          />
        )}

      {/* CLOSE HELPER INDICATOR */}
      {isDrawing && showCloseHelper && closeLine && committedRel.length > 0 && (
        <g
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Use the same pattern as double-click handler
            const pts = basePointsRef.current;
            if (pts.length >= 2 && onComplete) {
              onComplete(pts);
              setCurrentMousePos(null);
              setShowCloseHelper(false);
            }
          }}
          onClick={(e) => {
            // Prevent click from propagating to onSvgClick (which would add a point)
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={committedPx[0]?.x}
            cy={committedPx[0]?.y}
            r={HIT_R * invScale}
            fill="rgba(0,102,204,0.1)"
            stroke="#0066cc"
            strokeWidth={2 * invScale}
          />
          <circle
            cx={committedPx[0]?.x}
            cy={committedPx[0]?.y}
            r={ANCHOR_R_HOVERED * invScale}
            fill="#0066cc"
            stroke="#fff"
            strokeWidth={2 * invScale}
            style={{ pointerEvents: "none" }}
          />
        </g>
      )}

      {isDrawing && snapHelper && (
        <g style={{ pointerEvents: "none" }}>
          <circle
            cx={snapHelper.x}
            cy={snapHelper.y}
            r={HIT_R * invScale * 0.8}
            fill="rgba(255, 77, 217, 0.15)"
            stroke={SNAP_COLOR}
            strokeWidth={2 * invScale}
          />
          <circle
            cx={snapHelper.x}
            cy={snapHelper.y}
            r={ANCHOR_R_HOVERED * invScale}
            fill={SNAP_COLOR}
            stroke="#fff"
            strokeWidth={2 * invScale}
          />
        </g>
      )}

      {/* ANCHORS */}
      {isEditable &&
        committedRel.map((p, i) => {
          const pointPx = committedPx[i];
          const px = pointPx?.x;
          const py = pointPx?.y;
          const isSquare = p?.type !== "circle";
          const hovered =
            hoverIdx === i ||
            (draggingRef.current.active && draggingRef.current.idx === i);
          const anchorSize = (hovered ? ANCHOR_R_HOVERED : ANCHOR_R) * invScale;
          const hitRadius = HIT_R * invScale;
          return (
            <g key={`anchor-${i}`}>
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

      {/* INSERTION INDICATOR */}
      {isEditable &&
        segmentProjection &&
        !isDrawing &&
        !draggingRef.current.active && (
          <g
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newPoints = [...committedRel];
              const insertIdx = segmentProjection.segmentIdx + 1;
              newPoints.splice(insertIdx, 0, segmentProjection.point);
              onPointsChange && onPointsChange(newPoints);
              onChange && onChange({ ...polyline, points: newPoints });
              setSegmentProjection(null);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={segmentProjectionPx?.point.x}
              cy={segmentProjectionPx?.point.y}
              r={HIT_R * invScale}
              fill="rgba(0,102,204,0.1)"
              stroke="#0066cc"
              strokeWidth={2 * invScale}
            />
            <circle
              cx={segmentProjectionPx?.point.x}
              cy={segmentProjectionPx?.point.y}
              r={ANCHOR_R_HOVERED * invScale}
              fill="#0066cc"
              stroke="#fff"
              strokeWidth={2 * invScale}
              style={{ pointerEvents: "none" }}
            />
          </g>
        )}

      {/* CUT POLYLINES (HOLES) - Render separately for editing */}
      {activeCuts &&
        Array.isArray(activeCuts) &&
        activeCuts.length > 0 &&
        activeCuts.map((cut, cutIdx) => {
          if (!cut || !Array.isArray(cut.points) || cut.points.length < 2) {
            return null;
          }

          const cutRel = cut.points || [];
          const cutPx = cutRel.map((p) => ({ x: p.x * w, y: p.y * h }));
          const isEditingCut = editingCutId === cut.id;

          // Build path for this cut
          const cutPathResult = buildPathAndMap(
            cutRel,
            cut.closeLine !== false,
            []
          );
          const cutPathD = cutPathResult.d;

          return (
            <g key={`cut-${cut.id || cutIdx}`}>
              {/* Cut outline - different style to distinguish from main */}
              {cutPx.length >= 2 && strokeType !== "NONE" && (
                <path
                  d={cutPathD}
                  fill="none"
                  stroke={isEditingCut ? "#ff6600" : "#ffaa00"}
                  strokeWidth={computedStrokeWidthPx}
                  strokeOpacity={strokeProps.strokeOpacity * 0.8}
                  strokeDasharray={
                    isEditingCut
                      ? undefined
                      : `${computedStrokeWidthPx} ${computedStrokeWidthPx}`
                  }
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Cut anchors - only show when editing this cut or selected */}
              {isEditable &&
                isEditingCut &&
                cutRel.map((p, i) => {
                  const pointPx = cutPx[i];
                  const px = pointPx?.x;
                  const py = pointPx?.y;
                  const isSquare = p?.type !== "circle";
                  const hovered =
                    hoverIdx === `cut-${cut.id}-${i}` ||
                    (draggingRef.current.active &&
                      draggingRef.current.idx === i &&
                      draggingRef.current.cutId === cut.id);
                  const anchorSize =
                    (hovered ? ANCHOR_R_HOVERED : ANCHOR_R) * invScale;
                  const hitRadius = HIT_R * invScale;

                  return (
                    <g key={`cut-anchor-${cut.id}-${i}`}>
                      <circle
                        cx={px}
                        cy={py}
                        r={hitRadius}
                        fill="transparent"
                        stroke="transparent"
                        style={{
                          cursor: draggingRef.current.active
                            ? "grabbing"
                            : "grab",
                        }}
                        onMouseEnter={() => setHoverIdx(`cut-${cut.id}-${i}`)}
                        onMouseLeave={() =>
                          !draggingRef.current.active && setHoverIdx(null)
                        }
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          draggingRef.current = {
                            active: true,
                            idx: i,
                            cutId: cut.id,
                            pointerId: e.pointerId ?? "mouse",
                          };
                          document.addEventListener(
                            "pointermove",
                            onDocPointerMove,
                            { passive: false }
                          );
                          document.addEventListener(
                            "pointerup",
                            onDocPointerUp,
                            { passive: false }
                          );
                          document.addEventListener(
                            "pointercancel",
                            onDocPointerUp,
                            { passive: false }
                          );
                          // Create temp points for cut editing
                          // Initialize tempPointsRef if needed
                          if (!tempPointsRef.current) {
                            tempPointsRef.current = basePoints.map((p) => ({
                              ...p,
                            }));
                          }
                          // Store cut points for editing
                          const currentCuts = (activeCuts || cuts).map((c) => ({
                            ...c,
                            points: c.points.map((pt) => ({ ...pt })),
                          }));
                          tempPointsRef.current.cuts = currentCuts;
                          setTempCuts(currentCuts);
                          scheduleTempCommit();
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dispatch(
                            setClickedNode({
                              id: polyline?.id,
                              pointIndex: i,
                              cutId: cut.id,
                            })
                          );
                          dispatch(
                            setAnchorPosition({ x: e.clientX, y: e.clientY })
                          );
                        }}
                      />
                      {isSquare ? (
                        <rect
                          x={px - anchorSize}
                          y={py - anchorSize}
                          width={anchorSize * 2}
                          height={anchorSize * 2}
                          fill={hovered ? "#ff6600" : "#ffaa00"}
                          stroke="#ffffff"
                          strokeWidth={2 * invScale}
                          style={{ pointerEvents: "none" }}
                        />
                      ) : (
                        <circle
                          cx={px}
                          cy={py}
                          r={anchorSize}
                          fill={hovered ? "#ff6600" : "#ffaa00"}
                          stroke="#ffffff"
                          strokeWidth={2 * invScale}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </g>
                  );
                })}
            </g>
          );
        })}
    </g>
  );
}
