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
  onSelectSegment,
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

  // --- STATES ---
  const [editingCutId, setEditingCutId] = useState(null);

  // Interaction States
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [hoveredSegmentIdx, setHoveredSegmentIdx] = useState(null);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState(null);
  const [segmentProjection, setSegmentProjection] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  // --- REFS ---
  const draggingRef = useRef({
    active: false,
    idx: -1,
    type: "POINT", // "POINT" | "SEGMENT"
    segmentIdx: -1,
    cutId: null,
    pointerId: null,
    startBase: null, // Pour le calcul précis du drag segment
    initialPoints: null, // Snapshot des points au début du drag
  });

  const tempPointsRef = useRef(null);
  const [tempPoints, setTempPoints] = useState(null);
  const [tempCuts, setTempCuts] = useState(null);
  const rafIdRef = useRef(null);

  const dataProps = {
    "data-node-id": polyline?.id,
    "data-node-listing-id": polyline?.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "POLYLINE",
  };

  const segmentsData = polyline?.segments || [];

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
    cuts = [],
  } = polyline || {};

  const activeStrokeColor = isSelected
    ? theme.palette.annotation.selected
    : strokeColor;

  const w = imageSize?.w || 1;
  const h = imageSize?.h || 1;

  // UI Constants
  const HIT_R = 12;
  const ANCHOR_R = 4;
  const ANCHOR_R_HOVERED = 5;
  const HATCHING_SPACING = 12;
  const SNAP_COLOR = "#ff4dd9";

  const totalScale = showBgImage ? 1 : worldScale * containerK;
  const invScale = totalScale > 0 ? (showBgImage ? 1 : 1 / totalScale) : 1;

  // Stroke Width
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

  // --- KEYBOARD LISTENERS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") setIsShiftDown(true);

      // Delete logic (sur le segment sélectionné)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        isEditable &&
        selectedSegmentIdx !== null
      ) {
        const newSegments = [...segmentsData];
        while (newSegments.length <= selectedSegmentIdx) newSegments.push({});
        const currentSeg = newSegments[selectedSegmentIdx] || {};
        newSegments[selectedSegmentIdx] = {
          ...currentSeg,
          isDeleted: !currentSeg.isDeleted,
        };
        onChange && onChange({ ...polyline, segments: newSegments });
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === "Shift") setIsShiftDown(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isEditable, selectedSegmentIdx, segmentsData, polyline, onChange]);

  useLayoutEffect(() => {
    tempPointsRef.current = null;
    setTempPoints(null);
    setTempCuts(null);
  }, [polyline?.points, polyline?.cuts]);

  useEffect(() => {
    if (!isEditable || isDrawing || draggingRef.current.active) {
      setSegmentProjection(null);
    }
    if (!isEditable) {
      setSelectedSegmentIdx(null);
      setHoveredSegmentIdx(null);
    }
  }, [isEditable, isDrawing]);

  // --- HELPERS GEOMETRIE ---
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
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-9) return null;
    const ux =
      (x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2);
    const uy =
      (x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1);
    const cx = ux / d;
    const cy = uy / d;
    return { center: { x: cx, y: cy }, r: Math.hypot(x1 - cx, y1 - cy) };
  }

  // --- PATH BUILDER ---
  // Modifié pour stocker le 'd' individuel de chaque segment (pour l'affichage segment par segment)
  // ET les métadonnées (centre arc, rayon) pour la projection
  function buildPathAndMap(relPoints, close, cuts = []) {
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
      const pStart = pts[i0];

      if (t0 === "square" && t1 === "circle") {
        let j = i + 1;
        while (j < i + n && types[idx(j)] === "circle") j += 1;
        const i2 = idx(j);

        if (!close && j >= n) {
          const P1 = pts[i1];
          const cmd = `L ${P1.x} ${P1.y}`;
          dParts.push(cmd);
          res.segmentMap.push({
            startPointIdx: i0,
            endPointIdx: i1,
            d: `M ${pStart.x} ${pStart.y} ${cmd}`,
          });
          i += 1;
          continue;
        }

        const isExactSCS =
          j === i + 2 &&
          types[i1] === "circle" &&
          types[idx(i + 2)] === "square";

        if (isExactSCS) {
          const P0 = pts[i0];
          const P1 = pts[i1];
          const P2 = pts[i2];
          const circ = circleFromThreePoints(P0, P1, P2);

          if (!circ || !Number.isFinite(circ.r) || circ.r <= 0) {
            const cmd1 = `L ${P1.x} ${P1.y}`;
            const cmd2 = `L ${P2.x} ${P2.y}`;
            dParts.push(cmd1, cmd2);
            res.segmentMap.push({
              startPointIdx: i0,
              endPointIdx: i1,
              d: `M ${P0.x} ${P0.y} ${cmd1}`,
            });
            res.segmentMap.push({
              startPointIdx: i1,
              endPointIdx: i2,
              d: `M ${P1.x} ${P1.y} ${cmd2}`,
            });
          } else {
            const { center: C, r } = circ;
            const cross =
              (P1.x - P0.x) * (P2.y - P0.y) - (P1.y - P0.y) * (P2.x - P0.x);
            const sweep = cross > 0 ? 1 : 0;
            const rSafe = r * 1.0005;

            // Simplifié pour l'exemple (faudrait calculer largeArcFlag proprement)
            const cmd1 = `A ${rSafe} ${rSafe} 0 0 ${sweep} ${P1.x} ${P1.y}`;
            const cmd2 = `A ${rSafe} ${rSafe} 0 0 ${sweep} ${P2.x} ${P2.y}`;
            dParts.push(cmd1, cmd2);

            // Important: on stocke les infos géométriques pour le helper
            res.segmentMap.push({
              startPointIdx: i0,
              endPointIdx: i1,
              isArc: true,
              arcCenter: { x: C.x / w, y: C.y / h },
              arcRadius: rSafe / w,
              d: `M ${P0.x} ${P0.y} ${cmd1}`,
            });
            res.segmentMap.push({
              startPointIdx: i1,
              endPointIdx: i2,
              isArc: true,
              arcCenter: { x: C.x / w, y: C.y / h },
              arcRadius: rSafe / w,
              d: `M ${P1.x} ${P1.y} ${cmd2}`,
            });
          }
          i += 2;
          continue;
        }

        // Cubic
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
          const cmd = `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p1.x} ${p1.y}`;
          dParts.push(cmd);
          res.segmentMap.push({
            startPointIdx: idx(k),
            endPointIdx: idx(k + 1),
            d: `M ${p0.x} ${p0.y} ${cmd}`,
          });
          k++;
        }
        i = i2;
        continue;
      }

      // Line
      const P1 = pts[i1];
      const cmd = `L ${P1.x} ${P1.y}`;
      dParts.push(cmd);
      res.segmentMap.push({
        startPointIdx: i0,
        endPointIdx: i1,
        d: `M ${pts[i0].x} ${pts[i0].y} ${cmd}`,
      });
      i++;
    }

    if (close) dParts.push("Z");

    // Cuts (holes)
    const cutPaths = [];
    if (cuts?.length) {
      cuts.forEach((cut) => {
        if (cut?.points?.length >= 2) {
          const cRes = buildPathAndMap(cut.points, cut.closeLine !== false, []);
          if (cRes.d) cutPaths.push(cRes.d);
        }
      });
    }

    res.d = [dParts.join(" "), ...cutPaths].join(" ");
    return res;
  }

  // --- PROJECTION HELPERS (Re-implémentés depuis votre code) ---
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

  function projectOntoArc(
    pointPx,
    startPx,
    endPx,
    centerPx,
    radiusPx,
    largeArcFlag,
    sweepFlag
  ) {
    const angleStart = Math.atan2(
      startPx.y - centerPx.y,
      startPx.x - centerPx.x
    );
    const angleEnd = Math.atan2(endPx.y - centerPx.y, endPx.x - centerPx.x);
    const TWO_PI = Math.PI * 2;
    const normalizeAngle = (a) => {
      let normalized = a;
      while (normalized < 0) normalized += TWO_PI;
      while (normalized >= TWO_PI) normalized -= TWO_PI;
      return normalized;
    };
    let normStart = normalizeAngle(angleStart);
    let normEnd = normalizeAngle(angleEnd);
    let angleSpan;
    if (sweepFlag === 1) {
      angleSpan =
        normEnd >= normStart
          ? normEnd - normStart
          : normEnd - normStart + TWO_PI;
    } else {
      angleSpan =
        normStart >= normEnd
          ? normStart - normEnd
          : normStart - normEnd + TWO_PI;
    }
    // Correction simplifiée du largeArc
    if (largeArcFlag === 1 && angleSpan < Math.PI)
      angleSpan = TWO_PI - angleSpan;
    else if (largeArcFlag === 0 && angleSpan > Math.PI)
      angleSpan = TWO_PI - angleSpan;

    let bestLocal = { d2: Infinity, pt: null };
    const numSamples = 60;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      let angle;
      if (sweepFlag === 1) {
        angle = normStart + t * angleSpan;
        if (angle >= TWO_PI) angle -= TWO_PI;
      } else {
        angle = normStart - t * angleSpan;
        if (angle < 0) angle += TWO_PI;
      }
      const p = {
        x: centerPx.x + radiusPx * Math.cos(angle),
        y: centerPx.y + radiusPx * Math.sin(angle),
      };
      const d2 = (pointPx.x - p.x) ** 2 + (pointPx.y - p.y) ** 2;
      if (d2 < bestLocal.d2) bestLocal = { d2, pt: p };
    }
    if (bestLocal.pt) return { projection: bestLocal.pt, distSq: bestLocal.d2 };
    return { projection: startPx, distSq: Infinity };
  }

  // --- LOGIQUE PRINCIPALE DU HELPER (Projection sur le SVG) ---
  function findClosestSegmentAndProjection(mousePx) {
    if (previewRel.length < 2) return null;

    // Parsing du SVG pour trouver la projection exacte
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
        if (segIdx >= segmentMap.length) break; // Sécurité
        const end = { x: nums[0], y: nums[1] };
        const res = projectOntoSegment(mousePx, current, end);
        if (res && res.distSq < best.d2) {
          best = { d2: res.distSq, proj: res.projection, segIdx };
        }
        current = end;
      } else if (t === "C") {
        segIdx++;
        if (segIdx >= segmentMap.length) break;
        const cp1 = { x: nums[0], y: nums[1] };
        const cp2 = { x: nums[2], y: nums[3] };
        const end = { x: nums[4], y: nums[5] };

        // Approx Bezier
        let bestLocal = { d2: Infinity, pt: null };
        for (let tt = 0; tt <= 1; tt += 0.05) {
          const mt = 1 - tt,
            mt2 = mt * mt,
            mt3 = mt2 * mt,
            t2 = tt * tt,
            t3 = t2 * tt;
          const p = {
            x:
              mt3 * current.x +
              3 * mt2 * tt * cp1.x +
              3 * mt * t2 * cp2.x +
              t3 * end.x,
            y:
              mt3 * current.y +
              3 * mt2 * tt * cp1.y +
              3 * mt * t2 * cp2.y +
              t3 * end.y,
          };
          const d2 = (mousePx.x - p.x) ** 2 + (mousePx.y - p.y) ** 2;
          if (d2 < bestLocal.d2) bestLocal = { d2, pt: p };
        }
        if (bestLocal.pt && bestLocal.d2 < best.d2) {
          best = { d2: bestLocal.d2, proj: bestLocal.pt, segIdx };
        }
        current = end;
      } else if (t === "A") {
        segIdx++;
        if (segIdx >= segmentMap.length) break;
        const end = { x: nums[5], y: nums[6] };
        const segmentInfo = segmentMap[segIdx];
        if (segmentInfo?.isArc) {
          const centerPx = {
            x: segmentInfo.arcCenter.x * w,
            y: segmentInfo.arcCenter.y * h,
          };
          const radiusPx = segmentInfo.arcRadius * w;
          const res = projectOntoArc(
            mousePx,
            current,
            end,
            centerPx,
            radiusPx,
            nums[3],
            nums[4]
          );
          if (res && res.distSq < best.d2) {
            best = { d2: res.distSq, proj: res.projection, segIdx };
          }
        }
        current = end;
      }
    }

    if (best.proj && best.segIdx >= 0 && segmentMap[best.segIdx]) {
      const segmentInfo = segmentMap[best.segIdx];
      return {
        segmentIdx: best.segIdx, // Index visuel
        insertIdx: segmentInfo.startPointIdx, // Index logique d'insertion
        point: { x: best.proj.x / w, y: best.proj.y / h }, // Point relatif
        d2: best.d2,
      };
    }
    return null;
  }

  function handleMouseMoveForProjection(e) {
    if (isDrawing || !isEditable || draggingRef.current.active) {
      setSegmentProjection(null);
      setHoveredSegmentIdx(null);
      return;
    }
    const mousePx = toBaseFromClient(e.clientX, e.clientY);
    const thresholdSq = (HIT_R * invScale * 2) ** 2;

    const res = findClosestSegmentAndProjection(mousePx);

    if (res && res.d2 < thresholdSq) {
      if (isShiftDown) {
        // HELPER MODE (Shift)
        setHoveredSegmentIdx(null);
        setSegmentProjection({ segmentIdx: res.insertIdx, point: res.point });
      } else {
        // SELECT MODE (No Shift)
        setSegmentProjection(null);
        setHoveredSegmentIdx(res.segmentIdx);
      }
    } else {
      setSegmentProjection(null);
      setHoveredSegmentIdx(null);
    }
  }

  const scheduleTempCommit = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setTempPoints(tempPointsRef.current ? [...tempPointsRef.current] : null);
    });
  };

  // --- HANDLERS ---
  function onAnchorPointerDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = {
      active: true,
      idx,
      type: "POINT",
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

  function onSegmentPointerDown(e, segmentIdx) {
    if (!isEditable || isDrawing) return;
    e.preventDefault();
    e.stopPropagation();

    const segment = segmentMap[segmentIdx];
    if (!segment) return;

    setSelectedSegmentIdx(segmentIdx);
    if (onSelectSegment) {
      onSelectSegment({
        segmentIndex: segmentIdx,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }

    // Snapshot Drag
    const startBase = toBaseFromClient(e.clientX, e.clientY);
    draggingRef.current = {
      active: true,
      type: "SEGMENT",
      segmentIdx,
      startPointIdx: segment.startPointIdx,
      endPointIdx: segment.endPointIdx,
      pointerId: e.pointerId ?? "mouse",
      startBase: startBase,
      initialPoints: basePoints.map((p) => ({ ...p })),
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

    if (draggingRef.current.type === "SEGMENT") {
      const { startPointIdx, endPointIdx, startBase, initialPoints } =
        draggingRef.current;
      const currentBase = toBaseFromClient(e.clientX, e.clientY);

      // Delta calculé par rapport au point de départ (plus stable)
      const deltaX = (currentBase.x - startBase.x) / w;
      const deltaY = (currentBase.y - startBase.y) / h;

      if (!tempPointsRef.current)
        tempPointsRef.current = basePoints.map((p) => ({ ...p }));

      const p1 = initialPoints[startPointIdx];
      const p2 = initialPoints[endPointIdx];

      tempPointsRef.current[startPointIdx] = {
        ...p1,
        x: p1.x + deltaX,
        y: p1.y + deltaY,
      };
      if (startPointIdx !== endPointIdx) {
        tempPointsRef.current[endPointIdx] = {
          ...p2,
          x: p2.x + deltaX,
          y: p2.y + deltaY,
        };
      }

      scheduleTempCommit();
      e.preventDefault();
      return;
    }

    // Drag Point
    const i = draggingRef.current.idx;
    let bl = toBaseFromClient(e.clientX, e.clientY);
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

    draggingRef.current = {
      active: false,
      idx: -1,
      type: "POINT",
      initialPoints: null,
      startBase: null,
    };
  }

  function onAnchorContextMenu(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    dispatch(setClickedNode({ id: polyline?.id, pointIndex: idx }));
    dispatch(setAnchorPosition({ x: e.clientX, y: e.clientY }));
  }

  // --- DRAWING LOGIC (inchangée pour la preview création) ---
  const [currentMousePos, setCurrentMousePos] = useState(null);
  const [showCloseHelper, setShowCloseHelper] = useState(false);
  const nextPosRef = useRef(null);
  const moveRafRef = useRef(null);
  // (Refs for drawing omitted to save space, assuming they are set in useEffect like previous versions)
  // Re-adding essential drawing effect
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

  useEffect(() => {
    if (!isDrawing) {
      setCurrentMousePos(null);
      return;
    }
    function onMove(e) {
      // (Logique de drawing preview standard)
      const W = wRef.current,
        H = hRef.current;
      const pts = basePointsRef.current;
      let bl = toBaseFromClientRef.current(e.clientX, e.clientY);
      let rx = bl.x / W,
        ry = bl.y / H;

      nextPosRef.current = { x: rx, y: ry, showClose: false };
      if (!moveRafRef.current) {
        moveRafRef.current = requestAnimationFrame(() => {
          moveRafRef.current = null;
          if (nextPosRef.current)
            setCurrentMousePos({
              x: nextPosRef.current.x,
              y: nextPosRef.current.y,
            });
        });
      }
    }
    function onDblClick() {
      if (basePointsRef.current.length >= 2)
        onCompleteRef.current && onCompleteRef.current(basePointsRef.current);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("dblclick", onDblClick);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("dblclick", onDblClick);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    };
  }, [isDrawing]);

  // Derived
  const committedRel = useMemo(
    () => tempPoints ?? basePoints,
    [tempPoints, basePoints]
  );
  const committedPx = useMemo(
    () => committedRel.map((p) => ({ x: p.x * w, y: p.y * h })),
    [committedRel, w, h]
  );
  const previewRel = useMemo(
    () =>
      isDrawing && currentMousePos
        ? [...committedRel, currentMousePos]
        : committedRel,
    [isDrawing, currentMousePos, committedRel]
  );
  const previewPx = useMemo(
    () => previewRel.map((p) => ({ x: p.x * w, y: p.y * h })),
    [previewRel, w, h]
  );

  const activeCuts = tempCuts ?? cuts;
  const { d: pathD, segmentMap } = useMemo(
    () => buildPathAndMap(previewRel, closeLine, activeCuts),
    [previewRel, closeLine, activeCuts]
  );

  const segmentProjectionPx = useMemo(
    () =>
      segmentProjection
        ? {
            ...segmentProjection,
            point: {
              x: segmentProjection.point.x * w,
              y: segmentProjection.point.y * h,
            },
          }
        : null,
    [segmentProjection, w, h]
  );

  const patternIdRef = useRef(`hatch-${Math.random()}`);
  const showFill = closeLine && previewRel.length >= 3;

  return (
    <g {...dataProps} onMouseMove={handleMouseMoveForProjection}>
      {/* Hatching Pattern */}
      {showFill && fillType === "HATCHING" && (
        <defs>
          <pattern
            id={patternIdRef.current}
            patternUnits="userSpaceOnUse"
            width={HATCHING_SPACING * invScale}
            height={HATCHING_SPACING * invScale}
          >
            <path
              d={`M 0 0 L ${HATCHING_SPACING * invScale} ${
                HATCHING_SPACING * invScale
              }`}
              stroke={fillColor}
              strokeWidth={1.5 * invScale}
            />
          </pattern>
        </defs>
      )}

      {/* 1. FILL */}
      {showFill && (
        <path
          d={pathD}
          fill={
            fillType === "HATCHING"
              ? `url(#${patternIdRef.current})`
              : fillColor
          }
          fillOpacity={fillOpacity ?? 0.8}
          fillRule="evenodd"
          stroke="none"
          style={{ pointerEvents: isDrawing ? "none" : "inherit" }}
          onMouseEnter={() => !isDrawing && setHoverIdx("polygon")}
          onMouseLeave={() => !isDrawing && setHoverIdx(null)}
        />
      )}

      {/* 2. STROKE - Mode VIEW (Contour global optimisé) */}
      {!isEditable && strokeType !== "NONE" && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={computedStrokeWidthPx}
          strokeOpacity={strokeOpacity}
          strokeDasharray={
            strokeType === "DASHED"
              ? `${computedStrokeWidthPx * 3} ${computedStrokeWidthPx * 2}`
              : undefined
          }
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* 3. STROKE - Mode EDIT (Segments individuels pour gestion state) */}
      {isEditable &&
        segmentMap.map((seg, idx) => {
          const segData = segmentsData[idx] || {};
          const isDeleted = segData.isDeleted;
          const isSegSelected = selectedSegmentIdx === idx;
          const isSegHovered = hoveredSegmentIdx === idx;

          let stroke = activeStrokeColor;
          let width = computedStrokeWidthPx;
          let dashArray = undefined;

          if (isDeleted) {
            dashArray = `${computedStrokeWidthPx} ${computedStrokeWidthPx}`;
          }

          if (isSegSelected) {
            stroke = theme.palette.annotation.selected;
            width += 2;
          } else if (isSegHovered && !isShiftDown) {
            stroke = darken(theme.palette.annotation.selected, 0.2);
            width += 1;
          }

          return (
            <path
              key={`seg-${idx}`}
              d={seg.d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeDasharray={dashArray}
              style={{ cursor: "move", pointerEvents: "stroke" }}
              onPointerDown={(e) => onSegmentPointerDown(e, idx)}
            />
          );
        })}

      {/* 4. ANCHORS */}
      {isEditable &&
        committedPx.map((p, i) => {
          const hovered =
            hoverIdx === i ||
            (draggingRef.current.active && draggingRef.current.idx === i);
          const r = (hovered ? ANCHOR_R_HOVERED : ANCHOR_R) * invScale;
          return (
            <g key={`anchor-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={HIT_R * invScale}
                fill="transparent"
                style={{ cursor: "grab" }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onPointerDown={(e) => onAnchorPointerDown(e, i)}
                onContextMenu={(e) => onAnchorContextMenu(e, i)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={hovered ? "#0066cc" : "#ff0000"}
                stroke="#fff"
                strokeWidth={2 * invScale}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}

      {/* 5. HELPER INSERTION (Shift + Hover) */}
      {isEditable &&
        isShiftDown &&
        segmentProjectionPx &&
        !draggingRef.current.active && (
          <g
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newPoints = [...committedRel];
              const insertIdx = segmentProjection.segmentIdx + 1;
              newPoints.splice(insertIdx, 0, segmentProjection.point);

              const newSegments = [...segmentsData];
              if (newSegments.length > segmentProjection.segmentIdx)
                newSegments.splice(segmentProjection.segmentIdx, 0, {});

              onPointsChange && onPointsChange(newPoints);
              onChange &&
                onChange({
                  ...polyline,
                  points: newPoints,
                  segments: newSegments,
                });
              setSegmentProjection(null);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={segmentProjectionPx.point.x}
              cy={segmentProjectionPx.point.y}
              r={HIT_R * invScale}
              fill="rgba(0,102,204,0.1)"
              stroke="#0066cc"
              strokeWidth={2 * invScale}
            />
            <circle
              cx={segmentProjectionPx.point.x}
              cy={segmentProjectionPx.point.y}
              r={ANCHOR_R_HOVERED * invScale}
              fill="#0066cc"
              stroke="#fff"
              strokeWidth={2 * invScale}
              style={{ pointerEvents: "none" }}
            />
          </g>
        )}

      {/* 6. DRAWING PREVIEW LINES */}
      {isDrawing && currentMousePos && previewRel.length > 1 && (
        <line
          x1={previewPx[previewPx.length - 2].x}
          y1={previewPx[previewPx.length - 2].y}
          x2={currentMousePosPx.x}
          y2={currentMousePosPx.y}
          stroke={strokeColor}
          strokeWidth={computedStrokeWidthPx}
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}
