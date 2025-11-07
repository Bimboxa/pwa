// NodePolyline.js
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
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
  worldScale = 1,
  containerK = 1,
}) {
  const dispatch = useDispatch();
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);

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
  } = polyline || {};

  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // UI
  const HIT_R = 12;
  const ANCHOR_R = 4;
  const ANCHOR_R_HOVERED = 5;
  const CLOSE_TOL_SCREEN_PX = 10; // Fixed 10px screen distance
  const HATCHING_SPACING = 12;

  // keep UI constant on screen
  const totalScale = showBgImage ? 1 : worldScale * containerK;
  const invScale = totalScale > 0 ? (showBgImage ? 1 : 1 / totalScale) : 1;

  // stroke width
  const hasOffset =
    strokeOffset === 1 || strokeOffset === -1 || strokeOffset === 0;

  const computedStrokeWidthPx = useMemo(() => {
    let widthInPx = strokeWidth;

    const fixWidth = hasOffset && (isDrawing || selected);
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
    selected,
    hasOffset,
  ]);

  const strokeProps = useMemo(() => {
    if (strokeType === "NONE") return { stroke: "none", strokeOpacity: 0 };
    const props = {
      stroke: strokeColor,
      strokeOpacity: strokeOpacity ?? 1,
      strokeWidth: computedStrokeWidthPx,
    };
    if (strokeType === "DASHED") {
      const dash = computedStrokeWidthPx * 3;
      const gap = computedStrokeWidthPx * 2;
      props.strokeDasharray = `${dash} ${gap}`;
    }
    return props;
  }, [strokeType, strokeColor, strokeOpacity, computedStrokeWidthPx]);

  const hitStrokeWidth = useMemo(
    () => (showBgImage ? 10 / containerK : 10 * invScale),
    [showBgImage, containerK, invScale]
  );

  const rawPoints = polyline?.points || [];

  const applyOffset =
    !selected && hasOffset && Boolean(baseMapMeterByPx) && !isDrawing;

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
  const rafIdRef = useRef(null);

  useLayoutEffect(() => {
    tempPointsRef.current = null;
    setTempPoints(null);
  }, [
    polyline?.points?.map((p) => `${p.x},${p.y},${p.type ?? ""}`).join("|") ??
      "",
  ]);

  useEffect(() => {
    if (!selected || isDrawing || draggingRef.current.active)
      setSegmentProjection(null);
  }, [selected, isDrawing]);

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
  const wrap = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const angDown = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);

  function circleFromThreePoints(p0, p1, p2) {
    const ax = p1.x - p0.x,
      ay = p1.y - p0.y;
    const bx = p2.x - p0.x,
      by = p2.y - p0.y;
    const cross = ax * by - ay * bx;
    if (Math.abs(cross) < 1e-9) return null;
    const m1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const m2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const d1 = { x: -ay, y: ax };
    const d2 = { x: -by, y: bx };
    const denom = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((m2.x - m1.x) * d2.y - (m2.y - m1.y) * d2.x) / denom;
    const center = { x: m1.x + t * d1.x, y: m1.y + t * d1.y };
    const r = Math.hypot(p0.x - center.x, p0.y - center.y);
    return { center, r };
  }

  // angle utilities to keep a0 -> a1 -> a2 monotonic in one direction
  function betweenCW(a0, a1, a2) {
    a0 = wrap(a0);
    a1 = wrap(a1);
    a2 = wrap(a2);
    return a0 <= a2 ? a1 >= a0 && a1 <= a2 : a1 >= a0 || a1 <= a2;
  }
  function unwrapMonotonic(a0, a1, a2, dirCW) {
    let A0 = wrap(a0),
      A1 = wrap(a1),
      A2 = wrap(a2);
    if (dirCW) {
      if (A1 < A0) A1 += 2 * Math.PI;
      if (A2 < A1) A2 += 2 * Math.PI;
    } else {
      if (A1 > A0) A1 -= 2 * Math.PI;
      if (A2 > A1) A2 -= 2 * Math.PI;
    }
    return [A0, A1, A2];
  }

  // ----- Path builder (includes the fixed S–C–S arc logic)
  function buildPathAndMap(relPoints, close) {
    const res = { d: "", segmentMap: [] };
    if (!relPoints?.length) return res;

    const pts = relPoints.map(toPx);
    const types = relPoints.map(typeOf);
    const n = pts.length;

    const dParts = [`M ${pts[0].x} ${pts[0].y}`];
    if (n === 1) {
      res.d = dParts.join(" ");
      return res;
    }

    const idx = (i) => (close ? (i + n) % n : i);
    const limit = close ? n : n - 1;

    let i = 0;
    while (i < limit) {
      const i0 = idx(i);
      const i1 = idx(i + 1);
      const t0 = types[i0];
      const t1 = types[i1];

      if (t0 === "square" && t1 === "circle") {
        // find next square
        let j = i + 1;
        while (j < i + n && types[idx(j)] === "circle") j += 1;
        const i2 = idx(j);

        if (!close && i2 >= n) {
          dParts.push(`L ${pts[i1].x} ${pts[i1].y}`);
          res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1 });
          i += 1;
          continue;
        }

        if (i2 === i0 + 2) {
          // exact S–C–S → draw TWO arc commands on the SAME circle
          const P0 = pts[i0],
            P1 = pts[i0 + 1],
            P2 = pts[i2];
          const circ = circleFromThreePoints(P0, P1, P2);

          if (!circ || !isFinite(circ.r) || circ.r <= 0) {
            // fall back to lines
            dParts.push(`L ${P1.x} ${P1.y}`);
            dParts.push(`L ${P2.x} ${P2.y}`);
            res.segmentMap.push({ startPointIdx: i0, endPointIdx: i0 + 1 });
            res.segmentMap.push({ startPointIdx: i0 + 1, endPointIdx: i2 });
          } else {
            const { center: C, r } = circ;

            // angles (SVG y-down)
            const a0 = angDown(C, P0);
            const a1 = angDown(C, P1);
            const a2 = angDown(C, P2);

            // choose direction so P1 is between P0 and P2
            const dirCW = betweenCW(a0, a1, a2);
            const [A0, A1, A2] = unwrapMonotonic(a0, a1, a2, dirCW);

            const span01 = Math.abs(A1 - A0);
            const span12 = Math.abs(A2 - A1);

            // flags for both sub-arcs — SAME sweep for both, large-arc per span
            const sweep = dirCW ? 1 : 0;
            const large01 = span01 > Math.PI ? 1 : 0;
            const large12 = span12 > Math.PI ? 1 : 0;

            // emit two true circle arcs sharing r & sweep → same center
            dParts.push(`A ${r} ${r} 0 ${large01} ${sweep} ${P1.x} ${P1.y}`);
            dParts.push(`A ${r} ${r} 0 ${large12} ${sweep} ${P2.x} ${P2.y}`);

            res.segmentMap.push({
              startPointIdx: i0,
              endPointIdx: i0 + 1,
              isArc: true,
            });
            res.segmentMap.push({
              startPointIdx: i0 + 1,
              endPointIdx: i2,
              isArc: true,
            });
          }

          i += 2; // consumed 3 points
          continue;
        }

        // several circles between squares → simple smooth fallback (unchanged)
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
          dParts.push(`C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p1.x},${p1.y}`);
          res.segmentMap.push({
            startPointIdx: idx(k),
            endPointIdx: idx(k + 1),
          });
          k += 1;
        }
        i = i2;
        continue;
      }

      // default straight
      dParts.push(`L ${pts[i1].x} ${pts[i1].y}`);
      res.segmentMap.push({ startPointIdx: i0, endPointIdx: i1 });
      i += 1;
    }

    if (close) dParts.push("Z");
    res.d = dParts.join(" ");
    return res;
  }

  // projection helpers (unchanged; arcs are regular path segments here)
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
    draggingRef.current.active = false;
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

      const rx = bl.x / W;
      const ry = bl.y / H;

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

  const { d: pathD, segmentMap } = useMemo(
    () => buildPathAndMap(previewRel, closeLine),
    [previewRel, closeLine]
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
        // Arc command - approximate with sampled points for projection
        segIdx++;
        const rx = nums[0];
        const ry = nums[1];
        const xAxisRotation = nums[2];
        const largeArcFlag = nums[3];
        const sweepFlag = nums[4];
        const end = { x: nums[5], y: nums[6] };
        // Sample arc points for projection (simplified)
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
    if (isDrawing || !selected || draggingRef.current.active) {
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
          stroke={hoverIdx != null ? "#0066cc" : strokeProps.stroke}
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
            if (committedRel.length >= 2 && onComplete) {
              onComplete(committedRel);
              setCurrentMousePos(null);
              setShowCloseHelper(false);
            }
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

      {/* ANCHORS */}
      {selected &&
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
      {selected &&
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
    </g>
  );
}
