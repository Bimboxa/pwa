import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  forwardRef,
} from "react";

import { Box, Tooltip, IconButton } from "@mui/material";
import { CenterFocusStrong as CenterFocusStrongIcon } from "@mui/icons-material";

import editor from "App/editor";

import NodeSvgImage from "./NodeSvgImage";
import NodeAnnotation from "./NodeAnnotation";
import NodeLegend from "./NodeLegend";
import NodePolyline from "./NodePolyline";
import NodeRectangle from "./NodeRectangle";
import NodeSegment from "./NodeSegment";
import LayerMarkerTooltip from "Features/mapEditor/components/LayerMarkerTooltip";
import LayerAnnotationTooltip from "Features/mapEditor/components/LayerAnnotationTooltip";
import DraggableFabMarker from "Features/markers/components/DraggableFabMarker";
import HelperScale from "./HelperScale";

import clamp from "Features/misc/utils/clamp";
import {
  mFromTSR,
  mApply,
  mInverse,
  mMul,
} from "Features/matrix/utils/matrixHelpers";

import { useDispatch, useSelector } from "react-redux";
import {
  addPolylinePoint,
  addRectanglePoint,
  addSegmentPoint,
  setFixedLength,
  setFixedDims,
  triggerScreenToBaseLocalUpdate,
} from "Features/mapEditor/mapEditorSlice";
import applyFixedLengthConstraint from "Features/mapEditorGeneric/utils/applyFixedLengthConstraint";
import applyFixedDimsConstraint from "Features/mapEditorGeneric/utils/applyFixedDimsConstraint";
import getFixedDimsMeterFromString from "Features/mapEditorGeneric/utils/getFixedDimsMeterFromString";

const PADDING = 15;
const SNAP_THRESHOLD_PX = 10;
const SNAP_COLOR = "#ff4dd9";
const SNAP_GRID_CELL_SIZE = 200;

const MapEditorGeneric = forwardRef(function MapEditorGeneric(props, ref) {
  let {
    isMobile,
    bgImageUrl,
    baseMapId,
    baseMapImageUrl,
    baseMapMeterByPx, // Scale factor of the baseMap (meters per pixel)
    baseMapPoseInBg, // {x:0,y:0,k:1,r:0}, pose of baseMap in bg local coords.
    onBaseMapPoseInBgChange,
    baseMapOpacity,
    baseMapGrayScale,
    annotations,
    initialScale = "fit",
    minScale = 0.01,
    maxScale = 50,
    attachTo = "base", // "bg" or "base"
    showBgImage = true,
    cursor = "grab",
    enabledDrawingMode,
    selectedNode,
    onNodeClick,
    onNewAnnotation,
    onAnnotationClick,
    onAnnotationChange,
    onAnnotationDragEnd,
    annotationSpriteImage,
    selectedAnnotationIds = [],
    onClickInBg,
    onClickInBaseMap,
    legendItems,
    legendFormat,
    onLegendFormatChange,

    // annotation
    newAnnotation,

    // polyline
    onPolylineComplete,
    drawingPolylinePoints, // Array<{x,y}> in relative coords
    newPolylineProps,

    // rectangle
    onRectangleComplete,
    drawingRectanglePoints, // Array<{x,y}> with max 2 points
    newRectangleProps,

    // segment
    onSegmentComplete,
    drawingSegmentPoints, // Array<{x,y}> with max 2 points
    newSegmentProps,

    // refresh
    centerBaseMapTriggeredAt,
    zoomTo, // {x,y,triggeredAt}
    escapeTriggeredAt,

    // image
    onFilesDrop,
  } = props;

  const dispatch = useDispatch();

  // === REFS ===
  const containerRef = useRef();

  // click suppression
  const CLICK_DRAG_TOL = 5;
  const downRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  // === Viewport & world transform (world -> viewport) ===
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [world, setWorld] = useState({ x: 0, y: 0, k: 1 });

  // === Intrinsic sizes ===
  const [bgSize, setBgSize] = useState({ w: 0, h: 0 });
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });

  // === Layer poses ===
  const [bgPose, setBgPose] = useState({ x: 0, y: 0, k: 1, r: 0 });

  // === Hover state ===
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [isDraggingFabMarker, setIsDraggingFabMarker] = useState(false);
  const [snapHelper, setSnapHelper] = useState(null);
  const snapHelperRef = useRef(null);

  useEffect(() => {
    snapHelperRef.current = snapHelper;
  }, [snapHelper]);

  useEffect(() => {
    setIsDraggingAnnotation(false);
  }, [escapeTriggeredAt]);

  const basePose = useMemo(() => {
    if (!showBgImage) {
      // When not showing bg image, center the baseMap in the viewport with padding
      const availableWidth = viewport.w - PADDING * 2;
      const availableHeight = viewport.h - PADDING * 2;
      const scale =
        baseSize.w && baseSize.h && availableWidth && availableHeight
          ? Math.min(availableWidth / baseSize.w, availableHeight / baseSize.h)
          : 1;
      const k = clamp(scale, minScale, maxScale);
      const x = (viewport.w - baseSize.w * k) / 2;
      const y = (viewport.h - baseSize.h * k) / 2;
      return { x, y, k, r: 0 };
    } else {
      // When showing bg image, use original calculation
      return {
        x: bgPose.x + (baseMapPoseInBg.x || 0) * (bgPose.k || 1),
        y: bgPose.y + (baseMapPoseInBg.y || 0) * (bgPose.k || 1),
        k: (bgPose.k || 1) * (baseMapPoseInBg.k || 1),
        r: (bgPose.r || 0) + (baseMapPoseInBg.r || 0),
      };
    }
  }, [
    showBgImage,
    baseSize,
    viewport,
    minScale,
    maxScale,
    bgPose,
    baseMapPoseInBg,
  ]);

  const [basePoseIsChanging, setBasePoseIsChanging] = useState(false);

  // === Load sizes
  useEffect(() => {
    if (!bgImageUrl) return;
    const img = new Image();
    img.onload = () => setBgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = bgImageUrl;
  }, [bgImageUrl]);

  // Track previous baseMapId to preserve size when only switching images (regular/enhanced)
  const prevBaseMapIdRef = useRef(null);
  const preservedBaseSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    if (!baseMapImageUrl) return;

    // Check if baseMapId has changed (new baseMap selected)
    const baseMapIdChanged = baseMapId !== prevBaseMapIdRef.current;

    if (baseMapIdChanged) {
      // New baseMap - update the preserved size and load the image
      prevBaseMapIdRef.current = baseMapId;
      const img = new Image();
      img.onload = () => {
        const newSize = { w: img.naturalWidth, h: img.naturalHeight };
        preservedBaseSizeRef.current = newSize;
        setBaseSize(newSize);
      };
      img.src = baseMapImageUrl;
    } else {
      // Same baseMap, just switching between regular/enhanced images
      // Preserve the existing baseSize to avoid resetting worldScale/pose
      if (
        preservedBaseSizeRef.current.w > 0 &&
        preservedBaseSizeRef.current.h > 0
      ) {
        // Keep the preserved size - image will render with these dimensions
        // This ensures worldScale and pose remain unchanged
        setBaseSize(preservedBaseSizeRef.current);
      } else {
        // First load of this baseMap - load the image to get its size
        const img = new Image();
        img.onload = () => {
          const newSize = { w: img.naturalWidth, h: img.naturalHeight };
          preservedBaseSizeRef.current = newSize;
          setBaseSize(newSize);
        };
        img.src = baseMapImageUrl;
      }
    }
  }, [baseMapImageUrl, baseMapId]);

  // Observe container size
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setViewport({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // === ANNOTATIONS ===

  const bgImageAnnotations = showBgImage
    ? annotations.filter(({ nodeType }) => nodeType === "BG_IMAGE_TEXT")
    : [];
  const baseMapAnnotations = annotations.filter(({ baseMapId }) =>
    Boolean(baseMapId)
  );

  const snapTargets = useMemo(() => {
    if (
      enabledDrawingMode !== "POLYLINE" ||
      !baseMapAnnotations?.length ||
      !baseSize.w ||
      !baseSize.h
    )
      return null;

    const baseW = baseSize.w || 1;
    const baseH = baseSize.h || 1;
    const cellSize = SNAP_GRID_CELL_SIZE;
    const cells = new Map();

    const addCandidate = (candidate) => {
      const cx = Math.floor(candidate.x / cellSize);
      const cy = Math.floor(candidate.y / cellSize);
      const key = `${cx}:${cy}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(candidate);
    };

    const addSegment = (seg) => {
      const midX = (seg.x1 + seg.x2) / 2;
      const midY = (seg.y1 + seg.y2) / 2;
      addCandidate({ ...seg, x: midX, y: midY, type: "segment" });
    };

    // Helper to calculate circle from three points
    const circleFromThreePoints = (p0, p1, p2) => {
      const x1 = p0.x;
      const y1 = p0.y;
      const x2 = p1.x;
      const y2 = p1.y;
      const x3 = p2.x;
      const y3 = p2.y;

      const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
      if (Math.abs(d) < 1e-9) return null;

      const x1sq_y1sq = x1 * x1 + y1 * y1;
      const x2sq_y2sq = x2 * x2 + y2 * y2;
      const x3sq_y3sq = x3 * x3 + y3 * y3;

      const ux =
        (x1sq_y1sq * (y2 - y3) +
          x2sq_y2sq * (y3 - y1) +
          x3sq_y3sq * (y1 - y2)) /
        d;

      const uy =
        (x1sq_y1sq * (x3 - x2) +
          x2sq_y2sq * (x1 - x3) +
          x3sq_y3sq * (x2 - x1)) /
        d;

      const center = { x: ux, y: uy };
      const r = Math.hypot(x1 - ux, y1 - uy);

      return { center, r };
    };

    const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

    baseMapAnnotations.forEach((annotation) => {
      if (
        annotation &&
        (annotation.type === "POLYLINE" || annotation.type === "RECTANGLE")
      ) {
        const sourcePoints =
          annotation.points ||
          annotation.polyline?.points ||
          annotation.rectangle?.points ||
          annotation?.shape?.points;

        if (!Array.isArray(sourcePoints) || sourcePoints.length === 0) return;

        const pts = sourcePoints
          .map((p, idx) => ({
            x: (p.x ?? 0) * baseW,
            y: (p.y ?? 0) * baseH,
            type: typeOf(p),
            originalIndex: idx,
          }))
          .filter(
            (p) =>
              Number.isFinite(p.x) &&
              Number.isFinite(p.y) &&
              !Number.isNaN(p.x) &&
              !Number.isNaN(p.y)
          );

        if (pts.length === 0) return;

        const n = pts.length;
        const shouldClose =
          annotation.closeLine || annotation.type === "RECTANGLE";
        const idx = (i) => (shouldClose ? (i + n) % n : i);
        const limit = shouldClose ? n : n - 1;

        pts.forEach((pt) => {
          addCandidate({ type: "vertex", x: pt.x, y: pt.y });
        });

        let i = 0;
        while (i < limit) {
          const i0 = idx(i);
          const i1 = idx(i + 1);
          const p0 = pts[i0];
          const p1 = pts[i1];
          const t0 = p0.type;
          const t1 = p1.type;

          // Check for S–C–S pattern (square → circle → square)
          if (t0 === "square" && t1 === "circle") {
            let j = i + 1;
            while (j < i + n && pts[idx(j)].type === "circle") j += 1;
            const i2 = idx(j);

            if (!shouldClose && j >= n) {
              // Open path: ran off the end, use straight line
              addSegment({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
              i += 1;
              continue;
            }

            // Check if we have exactly one circle between two squares (S–C–S)
            if (j === i + 2 && pts[i2].type === "square") {
              const p2 = pts[i2];

              const circ = circleFromThreePoints(p0, p1, p2);

              if (circ && Number.isFinite(circ.r) && circ.r > 0) {
                // Determine winding order (CW vs CCW)
                const cross =
                  (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
                const isCW = cross > 0;

                // Calculate angles to determine large arc flags
                const angleFromCenter = (c, p) =>
                  Math.atan2(p.y - c.y, p.x - c.x);
                const getLargeArcFlag = (center, pStart, pEnd, isCW) => {
                  const aStart = angleFromCenter(center, pStart);
                  const aEnd = angleFromCenter(center, pEnd);
                  let diff = aEnd - aStart;
                  const TWO_PI = Math.PI * 2;

                  if (isCW) {
                    while (diff < 0) diff += TWO_PI;
                    while (diff >= TWO_PI) diff -= TWO_PI;
                  } else {
                    while (diff > 0) diff -= TWO_PI;
                    while (diff <= -TWO_PI) diff += TWO_PI;
                  }

                  return Math.abs(diff) > Math.PI ? 1 : 0;
                };

                const large01 = getLargeArcFlag(circ.center, p0, p1, isCW);
                const large12 = getLargeArcFlag(circ.center, p1, p2, isCW);
                const sweep = isCW ? 1 : 0;

                // Add arc segments for snapping
                const mid01 = {
                  x: (p0.x + p1.x) / 2,
                  y: (p0.y + p1.y) / 2,
                };
                addCandidate({
                  type: "arc",
                  x: mid01.x,
                  y: mid01.y,
                  start: p0,
                  end: p1,
                  center: circ.center,
                  radius: circ.r,
                  largeArcFlag: large01,
                  sweepFlag: sweep,
                });

                const mid12 = {
                  x: (p1.x + p2.x) / 2,
                  y: (p1.y + p2.y) / 2,
                };
                addCandidate({
                  type: "arc",
                  x: mid12.x,
                  y: mid12.y,
                  start: p1,
                  end: p2,
                  center: circ.center,
                  radius: circ.r,
                  largeArcFlag: large12,
                  sweepFlag: sweep,
                });

                i += 2; // consumed S–C–S
                continue;
              } else {
                // Degenerate case: straight lines
                addSegment({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
                addSegment({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
                i += 2;
                continue;
              }
            }

            // Generic case: S–C–…–C–S with > 1 circle in between
            let k = i;
            while (k < j) {
              const pk0 = pts[idx(k)];
              const pk1 = pts[idx(k + 1)];
              addSegment({
                x1: pk0.x,
                y1: pk0.y,
                x2: pk1.x,
                y2: pk1.y,
              });
              k += 1;
            }

            i = j;
            continue;
          }

          // Default: straight line segment
          addSegment({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
          i += 1;
        }
      }
    });

    return { cells, cellSize };
  }, [enabledDrawingMode, baseMapAnnotations, baseSize.w, baseSize.h]);

  // === INIT VIEWPORT ===

  const fit = useCallback(() => {
    if (!showBgImage) {
      // When not showing bg image, the basePose calculation handles centering
      // Just set world to origin since basePose will center the baseMap
      setWorld({ x: 0, y: 0, k: 1 });
    } else {
      // When showing bg image, use original logic
      const W = bgSize.w || baseSize.w;
      const H = bgSize.h || baseSize.h;
      if (!W || !H || !viewport.w || !viewport.h) return;
      const scale = Math.min(viewport.w / W, viewport.h / H) || 1;
      const k = clamp(scale, minScale, maxScale);
      const x = (viewport.w - W * k) / 2;
      const y = (viewport.h - H * k) / 2;
      setWorld({ x, y, k });
    }
  }, [bgSize, baseSize, viewport, minScale, maxScale, showBgImage]);

  useEffect(() => {
    if (initialScale === "fit") fit();
    else if (typeof initialScale === "number") {
      const k = clamp(initialScale, minScale, maxScale);
      if (!showBgImage) {
        // When not showing bg image, the basePose calculation handles centering
        setWorld({ x: 0, y: 0, k: 1 });
      } else {
        // When showing bg image, use original logic
        const W = bgSize.w || baseSize.w;
        const H = bgSize.h || baseSize.h;
        const x = (viewport.w - W * k) / 2;
        const y = (viewport.h - H * k) / 2;
        setWorld({ x, y, k });
      }
    }
  }, [initialScale, viewport, bgSize, baseSize, minScale, maxScale, fit, showBgImage]);

  useEffect(() => {
    if (centerBaseMapTriggeredAt) {
      fit();
    }
  }, [centerBaseMapTriggeredAt]);

  const triggerZoomTo = (x, y) => {
    const baseMapX = x * baseSize.w;
    const baseMapY = y * baseSize.h;

    // Get current position of the baseMap point in screen coordinates
    const currentScreenPos = baseLocalToScreen(baseMapX, baseMapY);

    // Calculate the viewport center
    const viewportCenter = {
      x: viewport.w / 2,
      y: viewport.h / 2,
    };

    // Calculate the offset needed to center the point
    const delta = {
      x: currentScreenPos.x - viewportCenter.x,
      y: currentScreenPos.y - viewportCenter.y,
    };

    // Get current world state for animation
    setWorld((currentWorld) => {
      const targetWorld = {
        x: currentWorld.x - delta.x,
        y: currentWorld.y - delta.y,
        k: currentWorld.k,
      };

      // Start smooth animation
      const startTime = Date.now();
      const duration = 500; // 500ms
      const startWorld = { ...currentWorld };

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Interpolate world transform
        const animatedWorld = {
          x: startWorld.x + (targetWorld.x - startWorld.x) * easeOut,
          y: startWorld.y + (targetWorld.y - startWorld.y) * easeOut,
          k: targetWorld.k, // Keep scale constant
        };

        setWorld(animatedWorld);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);

      // Return current world to avoid immediate state change
      return currentWorld;
    });
  };

  useEffect(() => {
    if (zoomTo?.triggeredAt) {
      triggerZoomTo(zoomTo.x, zoomTo.y);
    }
  }, [zoomTo?.triggeredAt]);

  // ============================
  // 🟢 PINCH + PAN (SIMPLIFIED - NO INERTIA)
  // ============================

  const [isPinching, setIsPinching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const pointersRef = useRef(new Map());
  const pinchRef = useRef({
    active: false,
    lastDist: 0,
    lastMid: { x: 0, y: 0 },
  });

  const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const getMidpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // === PANNING / GESTURES ===
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const onPointerDown = useCallback(
    (e) => {
      if (!containerRef.current) return;

      // Don't start panning if dragging the FAB marker
      if (isDraggingFabMarker) return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const count = pointersRef.current.size;

      if (count === 2) {
        setIsPinching(true);
        setIsPanning(false);
        movedRef.current = true;

        const [p1, p2] = Array.from(pointersRef.current.values());
        const dist = getDistance(p1, p2);
        const mid = getMidpoint(p1, p2);
        pinchRef.current = {
          active: true,
          lastDist: dist,
          lastMid: mid,
        };
        return;
      }

      if (count === 1) {
        setIsPanning(true);
        downRef.current = { x: e.clientX, y: e.clientY };
        movedRef.current = false;
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          tx: world.x,
          ty: world.y,
        };
      }
    },
    [world.x, world.y, isDraggingFabMarker]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // PINCH
      if (isPinching && pointersRef.current.size >= 2) {
        const [a, b] = Array.from(pointersRef.current.values());
        const dist = getDistance(a, b);
        const mid = getMidpoint(a, b);

        const factor =
          dist > 0 && pinchRef.current.lastDist > 0
            ? dist / pinchRef.current.lastDist
            : 1;

        const dxMid = mid.x - pinchRef.current.lastMid.x;
        const dyMid = mid.y - pinchRef.current.lastMid.y;

        // Batch zoom and pan into single state update
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && (factor !== 1 || dxMid || dyMid)) {
          const px = mid.x - rect.left;
          const py = mid.y - rect.top;

          setWorld((prevWorld) => {
            const newK = clamp(prevWorld.k * factor, minScale, maxScale);
            const wx = (px - prevWorld.x) / prevWorld.k;
            const wy = (py - prevWorld.y) / prevWorld.k;
            let newX = px - wx * newK;
            let newY = py - wy * newK;

            // Apply pan offset
            newX += dxMid;
            newY += dyMid;

            return { x: newX, y: newY, k: newK };
          });
        }

        pinchRef.current.lastDist = dist;
        pinchRef.current.lastMid = mid;
        return;
      }

      // PAN (1 pointer)
      if (!isPanning) return;

      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;

      if (
        !movedRef.current &&
        (Math.abs(e.clientX - downRef.current.x) > CLICK_DRAG_TOL ||
          Math.abs(e.clientY - downRef.current.y) > CLICK_DRAG_TOL)
      ) {
        movedRef.current = true;
      }

      setWorld((t) => ({
        ...t,
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      }));
    },
    [isPinching, isPanning, minScale, maxScale]
  );

  const endPan = useCallback(
    (e) => {
      if (!containerRef.current) return;

      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.delete(e.pointerId);
      }
      const count = pointersRef.current.size;

      if (isPinching) {
        if (count >= 2) return;
        setIsPinching(false);
        pinchRef.current.active = false;

        if (count === 1) {
          const [p] = Array.from(pointersRef.current.values());
          setIsPanning(true);
          panStart.current = { x: p.x, y: p.y, tx: world.x, ty: world.y };
          return;
        }
      } else {
        if (count === 0) {
          setIsPanning(false);
          if (movedRef.current) suppressNextClickRef.current = true;
        }
      }
    },
    [isPinching, world.x, world.y]
  );

  // === ZOOM TO POINTER (wheel desktop) ===
  const zoomAt = useCallback(
    (clientX, clientY, factor) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const newK = clamp(world.k * factor, minScale, maxScale);
      const wx = (px - world.x) / world.k;
      const wy = (py - world.y) / world.k;
      const newX = px - wx * newK;
      const newY = py - wy * newK;
      setWorld({ x: newX, y: newY, k: newK });
    },
    [world, minScale, maxScale]
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(e.clientX, e.clientY, factor);
    },
    [zoomAt]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [onWheel]);

  // === MATRICES FOR CONVERSIONS ===
  const Mvw = useMemo(() => mFromTSR(world.x, world.y, world.k, 0), [world]);
  const Mbg = useMemo(
    () => mFromTSR(bgPose.x, bgPose.y, bgPose.k, bgPose.r),
    [bgPose]
  );
  const Mbase = useMemo(
    () => mFromTSR(basePose.x, basePose.y, basePose.k, basePose.r),
    [basePose]
  );

  const screenToBgLocal = useCallback(
    (sx, sy) => {
      const inv = mInverse(mMul(Mvw, Mbg));
      return mApply(inv, sx, sy);
    },
    [Mvw, Mbg]
  );

  const baseLocalToScreen = useCallback(
    (sx, sy) => {
      const mat = mMul(Mvw, Mbase);
      const result = mApply(mat, sx, sy);
      return result;
    },
    [Mvw, Mbase, world, basePose]
  );

  const screenToBaseLocal = useCallback(
    (sx, sy) => {
      const inv = mInverse(mMul(Mvw, Mbase));
      const result = mApply(inv, sx, sy);
      return result;
    },
    [Mvw, Mbase, world, basePose]
  );

  useEffect(() => {
    if (
      !viewport.w ||
      !viewport.h ||
      !baseSize.w ||
      !baseSize.h ||
      typeof screenToBaseLocal !== "function"
    ) {
      return;
    }

    const corners = {
      topLeft: screenToBaseLocal(0, 0),
      topRight: screenToBaseLocal(viewport.w, 0),
      bottomLeft: screenToBaseLocal(0, viewport.h),
      bottomRight: screenToBaseLocal(viewport.w, viewport.h),
    };

    if (
      !corners.topLeft ||
      !corners.topRight ||
      !corners.bottomLeft ||
      !corners.bottomRight
    ) {
      return;
    }

    const xs = Object.values(corners).map((c) => c.x);
    const ys = Object.values(corners).map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    editor.viewportInBase = {
      corners,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      updatedAt: Date.now(),
    };
    // Store conversion function for use by other components
    editor.screenToBaseLocal = screenToBaseLocal;
    dispatch(triggerScreenToBaseLocalUpdate());
  }, [screenToBaseLocal, viewport.w, viewport.h, baseSize.w, baseSize.h, world, basePose]);

  const relBase = useMemo(() => {
    const kbg = bgPose.k || 1;
    return {
      x: (basePose.x - bgPose.x) / kbg,
      y: (basePose.y - bgPose.y) / kbg,
      k: (basePose.k || 1) / kbg,
    };
  }, [bgPose, basePose]);

  cursor = isPinching ? "grabbing" : isPanning ? "grabbing" : cursor;

  useEffect(() => {
    if (enabledDrawingMode !== "POLYLINE") {
      setSnapHelper(null);
    }
  }, [enabledDrawingMode]);

  const snapFrameRef = useRef(null);
  const pendingSnapPointRef = useRef(null);

  const handlePolylinePointerMove = useCallback(
    (basePoint) => {
      if (!basePoint) return;
      pendingSnapPointRef.current = basePoint;
      if (snapFrameRef.current) return;

      snapFrameRef.current = requestAnimationFrame(() => {
        snapFrameRef.current = null;
        const point = pendingSnapPointRef.current;
        pendingSnapPointRef.current = null;

        if (
          enabledDrawingMode !== "POLYLINE" ||
          !snapTargets ||
          !point ||
          !baseSize.w ||
          !baseSize.h
        ) {
          if (snapHelperRef.current) setSnapHelper(null);
          return;
        }

        const screenPos = baseLocalToScreen(point.x, point.y);
        const baseAtThreshold = screenToBaseLocal(
          screenPos.x + SNAP_THRESHOLD_PX,
          screenPos.y
        );
        let thresholdBase = Math.hypot(
          baseAtThreshold.x - point.x,
          baseAtThreshold.y - point.y
        );
        if (!Number.isFinite(thresholdBase)) {
          thresholdBase = SNAP_THRESHOLD_PX;
        }

        const cellSize = snapTargets.cellSize;
        const cx = Math.floor(point.x / cellSize);
        const cy = Math.floor(point.y / cellSize);
        const radius = Math.max(
          1,
          Math.ceil((thresholdBase + cellSize) / cellSize)
        );

        let bestVertex = null;
        let bestSegment = null;

        // Project a point onto a circular arc
        const projectOntoArc = (
          pointPx,
          startPx,
          endPx,
          centerPx,
          radiusPx,
          largeArcFlag,
          sweepFlag
        ) => {
          const angleStart = Math.atan2(
            startPx.y - centerPx.y,
            startPx.x - centerPx.x
          );
          const angleEnd = Math.atan2(
            endPx.y - centerPx.y,
            endPx.x - centerPx.x
          );

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

          if (largeArcFlag === 1 && angleSpan < Math.PI) {
            angleSpan = TWO_PI - angleSpan;
          } else if (largeArcFlag === 0 && angleSpan > Math.PI) {
            angleSpan = TWO_PI - angleSpan;
          }

          // Sample points along the arc and find closest
          let bestLocal = { d2: Infinity, pt: null };
          const numSamples = 100;

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
            if (d2 < bestLocal.d2) {
              bestLocal = { d2, pt: p };
            }
          }

          return bestLocal.pt || startPx;
        };

        const considerCandidate = (candidate) => {
          if (candidate.type === "arc") {
            const proj = projectOntoArc(
              point,
              candidate.start,
              candidate.end,
              candidate.center,
              candidate.radius,
              candidate.largeArcFlag,
              candidate.sweepFlag
            );
            const screen = baseLocalToScreen(proj.x, proj.y);
            const dist = Math.hypot(
              screen.x - screenPos.x,
              screen.y - screenPos.y
            );
            if (dist <= SNAP_THRESHOLD_PX) {
              if (!bestSegment || dist < bestSegment.screenDistance) {
                bestSegment = {
                  type: "segment",
                  x: proj.x,
                  y: proj.y,
                  screenDistance: dist,
                };
              }
            }
          } else if (candidate.type === "segment") {
            const proj = projectPointOnSegment(point.x, point.y, candidate);
            const screen = baseLocalToScreen(proj.x, proj.y);
            const dist = Math.hypot(
              screen.x - screenPos.x,
              screen.y - screenPos.y
            );
            if (dist <= SNAP_THRESHOLD_PX) {
              if (!bestSegment || dist < bestSegment.screenDistance) {
                bestSegment = {
                  type: "segment",
                  x: proj.x,
                  y: proj.y,
                  screenDistance: dist,
                };
              }
            }
          } else {
            const screen = baseLocalToScreen(candidate.x, candidate.y);
            const dist = Math.hypot(
              screen.x - screenPos.x,
              screen.y - screenPos.y
            );
            if (dist <= SNAP_THRESHOLD_PX) {
              if (!bestVertex || dist < bestVertex.screenDistance) {
                bestVertex = {
                  type: "vertex",
                  x: candidate.x,
                  y: candidate.y,
                  screenDistance: dist,
                };
              }
            }
          }
        };

        for (let ix = cx - radius; ix <= cx + radius; ix++) {
          for (let iy = cy - radius; iy <= cy + radius; iy++) {
            const key = `${ix}:${iy}`;
            const candidates = snapTargets.cells.get(key);
            if (candidates) {
              candidates.forEach(considerCandidate);
            }
          }
        }

        let best = bestVertex ?? bestSegment;

        if (!best && snapHelperRef.current) {
          const prev = snapHelperRef.current;
          const snapScreen = baseLocalToScreen(prev.x, prev.y);
          const dist = Math.hypot(
            snapScreen.x - screenPos.x,
            snapScreen.y - screenPos.y
          );
          if (dist <= SNAP_THRESHOLD_PX) {
            best = prev;
          }
        }

        if (best) {
          setSnapHelper({
            type: best.type,
            x: best.x,
            y: best.y,
            relX: best.x / baseSize.w,
            relY: best.y / baseSize.h,
          });
        } else if (snapHelperRef.current) {
          setSnapHelper(null);
        }
      });
    },
    [
      enabledDrawingMode,
      snapTargets,
      baseLocalToScreen,
      screenToBaseLocal,
      baseSize.w,
      baseSize.h,
    ]
  );

  useEffect(
    () => () => {
      if (snapFrameRef.current) {
        cancelAnimationFrame(snapFrameRef.current);
        snapFrameRef.current = null;
      }
    },
    []
  );

  // Convert client → container → base local px
  const toBaseFromClient = useCallback(
    (clientX, clientY) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return screenToBaseLocal(sx, sy);
    },
    [screenToBaseLocal]
  );

  // === MOUSE TRACKING FOR TOOLTIP ===
  const updateMousePosition = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  // Track mouse position for tooltip
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      updateMousePosition(e.clientX, e.clientY);
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
    };
  }, [updateMousePosition]);

  // === CLICK ===
  const onAnyPointerDownCapture = useCallback((e) => {
    downRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
  }, []);

  const onAnyPointerMoveCapture = useCallback((e) => {
    if (movedRef.current) return;
    const dx = e.clientX - downRef.current.x;
    const dy = e.clientY - downRef.current.y;
    if (Math.abs(dx) > CLICK_DRAG_TOL || Math.abs(dy) > CLICK_DRAG_TOL) {
      movedRef.current = true;
    }
  }, []);

  const onAnyPointerUpCapture = useCallback((e) => {
    if (movedRef.current) suppressNextClickRef.current = true;
  }, []);

  const onSvgClickCapture = useCallback((e) => {
    if (suppressNextClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false;
    }
  }, []);

  // === HOVER DETECTION ===
  const onSvgMouseMove = useCallback(
    (e) => {
      updateMousePosition(e.clientX, e.clientY);

      if (enabledDrawingMode === "POLYLINE") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const basePoint = screenToBaseLocal(sx, sy);
          handlePolylinePointerMove(basePoint);
        }
      } else if (snapHelperRef.current) {
        setSnapHelper(null);
      }

      if (enabledDrawingMode || selectedNode?.nodeType === "ANNOTATION") {
        if (hoveredMarker) setHoveredMarker(null);
        if (hoveredAnnotation) setHoveredAnnotation(null);
        return;
      }

      // Don't show tooltip while dragging an annotation
      if (isDraggingAnnotation) {
        setHoveredMarker(null);
        setHoveredAnnotation(null);
        return;
      }

      const nativeTarget = e.nativeEvent?.target || e.target;
      const hit = nativeTarget.closest?.("[data-node-type]");

      if (
        hit &&
        hit.dataset.nodeType === "ANNOTATION" &&
        hit.dataset.annotationType === "MARKER"
      ) {
        // Find the corresponding annotation
        const annotationId = hit.dataset.nodeId;
        const marker = annotations.find((ann) => ann.id === annotationId);
        if (marker) {
          setHoveredMarker(marker);
          setHoveredAnnotation(null);
          return;
        }
      }

      if (hit && hit.dataset.nodeType === "ANNOTATION") {
        const annotationId = hit.dataset.nodeId;
        const annotation = annotations.find((ann) => ann.id === annotationId);
        if (annotation) {
          setHoveredAnnotation(annotation);
          setHoveredMarker(null);
          return;
        }
      }

      setHoveredMarker(null);
      setHoveredAnnotation(null);
    },
    [
      annotations,
      updateMousePosition,
      isDraggingAnnotation,
      enabledDrawingMode,
      hoveredMarker,
      hoveredAnnotation,
      screenToBaseLocal,
      handlePolylinePointerMove,
    ]
  );

  const onSvgMouseLeave = useCallback(() => {
    setHoveredMarker(null);
    setHoveredAnnotation(null);
  }, []);

  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);
  const fixedDims = useSelector((s) => s.mapEditor.fixedDims);

  // === DRAG AND DROP HANDLERS ===
  const onDragOver = useCallback(
    (e) => {
      const hasFiles = e.dataTransfer?.types?.includes?.("Files");
      if (
        hasFiles &&
        (enabledDrawingMode === "MARKER" || typeof onFilesDrop === "function")
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [enabledDrawingMode, onFilesDrop]
  );

  const handleFilesDrop = useCallback(
    (files, clientX, clientY) => {
      if (!onFilesDrop || !files?.length) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const p_inBase = screenToBaseLocal(sx, sy);

      const ratioX = Math.max(0, Math.min(1, p_inBase.x / (baseSize.w || 1)));
      const ratioY = Math.max(0, Math.min(1, p_inBase.y / (baseSize.h || 1)));

      onFilesDrop({
        x: ratioX,
        y: ratioY,
        files,
      });
    },
    [onFilesDrop, screenToBaseLocal, baseSize.w, baseSize.h]
  );

  const onDrop = useCallback(
    (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      const hasFiles = files.length > 0;

      if (enabledDrawingMode === "MARKER") {
        e.preventDefault();
        const imageFiles = files.filter((file) =>
          file.type.startsWith("image/")
        );

        if (imageFiles.length === 0) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const p_inBg = screenToBgLocal(sx, sy);
        const p_inBase = screenToBaseLocal(sx, sy);

        // Use the first image file
        const imageFile = imageFiles[0];

        // Calculate position based on attachTo setting
        let ratioX, ratioY;
        if (attachTo === "bg") {
          ratioX = p_inBg.x / (bgSize.w || 1);
          ratioY = p_inBg.y / (bgSize.h || 1);
        } else {
          ratioX = p_inBase.x / (baseSize.w || 1);
          ratioY = p_inBase.y / (baseSize.h || 1);
        }

        // Clamp to bounds
        ratioX = Math.max(0, Math.min(1, ratioX));
        ratioY = Math.max(0, Math.min(1, ratioY));

        // Call onNewAnnotation with the image file
        if (onNewAnnotation) {
          onNewAnnotation({
            type: enabledDrawingMode,
            x: ratioX,
            y: ratioY,
            imageFile: imageFile,
          });
        }
        return;
      }

      if (hasFiles && typeof onFilesDrop === "function") {
        e.preventDefault();
        handleFilesDrop(files, e.clientX, e.clientY);
      }
    },
    [
      enabledDrawingMode,
      screenToBgLocal,
      screenToBaseLocal,
      attachTo,
      bgSize.w,
      bgSize.h,
      baseSize.w,
      baseSize.h,
      onNewAnnotation,
      onFilesDrop,
      handleFilesDrop,
    ]
  );

  const onMarkerDragStart = useCallback(() => {
    setIsDraggingFabMarker(true);
  }, []);

  const onMarkerDropped = useCallback(
    (event) => {
      setIsDraggingFabMarker(false);
      if (event) {
        console.log("dropped", event);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // event.x and event.y are absolute screen coordinates
        // We need to convert them to container-relative coordinates
        const sx = event.x - rect.left;
        const sy = event.y - rect.top;
        const p_inBase = screenToBaseLocal(sx, sy);

        const ratioX = p_inBase.x / (baseSize.w || 1);
        const ratioY = p_inBase.y / (baseSize.h || 1);

        if (onNewAnnotation) {
          onNewAnnotation({
            type: "MARKER",
            x: ratioX,
            y: ratioY,
            annotationTemplateId: event.annotationTemplateId,
          });
        }
      }
    },
    [screenToBaseLocal, baseSize.w, baseSize.h, onNewAnnotation]
  );

  const onSvgClick = useCallback(
    (e) => {
      if (isPanning || isPinching) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      console.log("onSvgClick - Client:", {
        clientX: e.clientX,
        clientY: e.clientY,
      });
      console.log("onSvgClick - Rect:", rect);
      console.log("onSvgClick - Screen:", { sx, sy });

      const p_inBg = screenToBgLocal(sx, sy);
      const p_inBase = screenToBaseLocal(sx, sy);

      const p_delta_inBg = screenToBgLocal(sx + 10, sy);
      const scaleToBgLocal = p_delta_inBg.x - p_inBg.x;
      const p_delta_inBase = screenToBaseLocal(sx + 10, sy);
      const scaleToBaseLocal = p_delta_inBase.x - p_inBase.x;

      onClickInBaseMap?.({
        x: p_inBase.x / baseSize.w,
        y: p_inBase.y / baseSize.h,
        scaleToBgLocal: scaleToBgLocal,
        scaleToBaseLocal: scaleToBaseLocal,
        x_absolute: p_inBase.x,
        y_absolute: p_inBase.y,
      });

      console.log("onSvgClick - Base local:", p_inBase);

      const nativeTarget = e.nativeEvent?.target || e.target;
      const hit = nativeTarget.closest?.("[data-node-type]");

      if (!hit && !enabledDrawingMode) {
        onNodeClick(null);
        return;
      }

      if (hit && !enabledDrawingMode) {
        const { nodeId, nodeListingId, nodeType, annotationType } = hit.dataset;
        onNodeClick({ id: nodeId, nodeListingId, nodeType, annotationType });
        return;
      }

      // ----- POLYLINE MODE (Shift-constrained commit) -----
      if (enabledDrawingMode === "POLYLINE") {
        if (e.detail > 1) {
          return;
        }
        // always use BASE layer for polyline points
        let bx = p_inBase.x;
        let by = p_inBase.y;

        // Apply the SAME Shift constraint as the preview (against the LAST committed point)
        const last = drawingPolylinePoints?.[drawingPolylinePoints.length - 1];
        const lastPx = last
          ? {
              x: (baseSize.w || 1) * last.x,
              y: (baseSize.h || 1) * last.y,
            }
          : null;

        if (e.shiftKey && lastPx) {
          const dx = bx - lastPx.x;
          const dy = by - lastPx.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            by = lastPx.y;
          } else {
            bx = lastPx.x;
          }
        }

        if (lastPx) {
          const constrainedPoint = applyFixedLengthConstraint({
            lastPointPx: lastPx,
            candidatePointPx: { x: bx, y: by },
            fixedLengthMeters: fixedLength,
            meterPerPixel: baseMapMeterByPx,
          });
          bx = constrainedPoint.x;
          by = constrainedPoint.y;
        }

        const baseW = baseSize.w || 1;
        const baseH = baseSize.h || 1;
        let ratioX = Math.max(0, Math.min(1, bx / baseW));
        let ratioY = Math.max(0, Math.min(1, by / baseH));

        if (snapHelper?.relX != null && snapHelper?.relY != null) {
          ratioX = snapHelper.relX;
          ratioY = snapHelper.relY;
          setSnapHelper(null);
        }

        dispatch(addPolylinePoint({ x: ratioX, y: ratioY }));
        dispatch(setFixedLength(""));
        return;
      }

      // ----- RECTANGLE MODE (2-click drawing) -----
      if (enabledDrawingMode === "RECTANGLE") {
        // always use BASE layer for rectangle points
        let bx = p_inBase.x;
        let by = p_inBase.y;

        const currentPointCount = drawingRectanglePoints?.length || 0;
        const fixedDimsMeter = getFixedDimsMeterFromString(fixedDims);

        // Apply fixedDims constraint when adding the second point
        if (
          currentPointCount === 1 &&
          fixedDimsMeter?.x != null &&
          fixedDimsMeter?.y != null &&
          baseMapMeterByPx
        ) {
          const firstPoint = drawingRectanglePoints[0];
          const firstPointPx = {
            x: (baseSize.w || 1) * firstPoint.x,
            y: (baseSize.h || 1) * firstPoint.y,
          };
          const constrainedPoint = applyFixedDimsConstraint({
            firstPointPx,
            candidatePointPx: { x: bx, y: by },
            fixedDimsMeters: fixedDimsMeter,
            meterPerPixel: baseMapMeterByPx,
          });
          bx = constrainedPoint.x;
          by = constrainedPoint.y;
        }

        // Clamp to image bounds and convert to relative
        const ratioX = Math.max(0, Math.min(1, bx / (baseSize.w || 1)));
        const ratioY = Math.max(0, Math.min(1, by / (baseSize.h || 1)));

        // Add the point
        dispatch(addRectanglePoint({ x: ratioX, y: ratioY }));

        // If this was the second point, complete the rectangle
        if (currentPointCount === 1) {
          // Second click - rectangle is complete
          const finalPoints = [
            ...drawingRectanglePoints,
            { x: ratioX, y: ratioY },
          ];
          if (onRectangleComplete) {
            onRectangleComplete(finalPoints);
          }
          // Clear fixedDims after completion
          dispatch(setFixedDims(null));
        }
        return;
      }

      // ----- SEGMENT MODE (2-click drawing) -----
      if (enabledDrawingMode === "SEGMENT") {
        // always use BASE layer for segment points
        let bx = p_inBase.x;
        let by = p_inBase.y;

        // Apply the SAME Shift constraint as the preview (against the FIRST committed point)
        const first = drawingSegmentPoints?.[0];
        if (e.shiftKey && first) {
          const firstPx = {
            x: (baseSize.w || 1) * first.x,
            y: (baseSize.h || 1) * first.y,
          };
          const dx = bx - firstPx.x;
          const dy = by - firstPx.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            // horizontal snap
            by = firstPx.y;
          } else {
            // vertical snap
            bx = firstPx.x;
          }
        }

        // Clamp to image bounds and convert to relative
        const ratioX = Math.max(0, Math.min(1, bx / (baseSize.w || 1)));
        const ratioY = Math.max(0, Math.min(1, by / (baseSize.h || 1)));

        const currentPointCount = drawingSegmentPoints?.length || 0;

        // Add the point
        dispatch(addSegmentPoint({ x: ratioX, y: ratioY }));

        // If this was the second point, complete the segment
        if (currentPointCount === 1) {
          // Second click - segment is complete
          const finalPoints = [
            ...drawingSegmentPoints,
            { x: ratioX, y: ratioY },
          ];
          if (onSegmentComplete) {
            const anchorPositionScale = { x: e.clientX, y: e.clientY };
            onSegmentComplete(finalPoints, anchorPositionScale);
          }
        }
        return;
      }

      // ----- OTHER ANNOTATIONS -----
      let ratioX, ratioY;
      if (attachTo === "bg") {
        ratioX = p_inBg.x / (bgSize.w || 1);
        ratioY = p_inBg.y / (bgSize.h || 1);
      } else {
        ratioX = p_inBase.x / (baseSize.w || 1);
        ratioY = p_inBase.y / (baseSize.h || 1);
      }

      console.log("Creating annotation - attachTo:", attachTo);
      console.log("Creating annotation - baseSize:", baseSize);
      console.log("Creating annotation - Final ratio:", { ratioX, ratioY });

      if (enabledDrawingMode && onNewAnnotation) {
        onNewAnnotation({ type: enabledDrawingMode, x: ratioX, y: ratioY });
      }
    },
    [
      isPanning,
      isPinching,
      enabledDrawingMode,
      screenToBgLocal,
      screenToBaseLocal,
      onNodeClick,
      attachTo,
      bgSize.w,
      bgSize.h,
      baseSize.w,
      baseSize.h,
      dispatch,
      drawingPolylinePoints, // include so last point is fresh
      fixedLength,
      baseMapMeterByPx,
    ]
  );

  // === DRAG AND DROP EVENT LISTENERS ===
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("drop", onDrop);
    return () => {
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
    };
  }, [onDragOver, onDrop]);

  // === ANNOTATION EVENTS ===
  function handleMarkerClick(annotation) {
    onAnnotationClick?.(annotation);
  }
  function handleAnnotationChange(annotation) {
    onAnnotationChange?.(annotation);
  }
  function handleAnnotationDragStart() {
    setIsDraggingAnnotation(true);
    setHoveredMarker(null); // Hide tooltip immediately
    setHoveredAnnotation(null);
  }
  function handleAnnotationDragEnd(annotation) {
    setIsDraggingAnnotation(false);
    suppressNextClickRef.current = true;
    onAnnotationChange?.(annotation);
  }

  // === BASE MAP POSE ===
  function handleBasePoseChange(delta) {
    const P = baseMapPoseInBg || { x: 0, y: 0, k: 1 };
    const kP = P.k || 1;

    onBaseMapPoseInBgChange?.({
      x: P.x + (delta.x || 0) * kP,
      y: P.y + (delta.y || 0) * kP,
      k: kP * (delta.k || 1),
    });

    setBasePoseIsChanging(false);
    suppressNextClickRef.current = true;
  }

  function handleLegendFormatChange(_legendFormat) {
    onLegendFormatChange(_legendFormat);
  }

  return (
    <Box
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        bgcolor: "background.default",
        touchAction: "none",
        userSelect: "none",
        cursor,
      }}
    >
      <Box
        sx={{ position: "absolute", bottom: "8px", left: "42px", zIndex: 2 }}
      >
        <HelperScale
          meterByPx={baseMapMeterByPx}
          worldK={world.k}
          basePoseK={basePose.k}
        />
      </Box>
      {isMobile && (
        <Box
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            right: "8px",
            top: "8px",
            zIndex: 2,
          }}
        >
          <DraggableFabMarker
            bgcolor={newAnnotation?.fillColor ?? "red"}
            onDragStart={onMarkerDragStart}
            onDropped={onMarkerDropped}
          />
        </Box>
      )}

      {/* Global controls */}
      <Box
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 2,
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 3,
          display: "flex",
        }}
      >
        {/* <Tooltip title="Fit to view">
          <IconButton
            onClick={() => {
              fit();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            size="small"
          >
            <CenterFocusStrongIcon />
          </IconButton>
        </Tooltip> */}
      </Box>

      {/* SVG scene */}
      <Box
        component="svg"
        onPointerDownCapture={onAnyPointerDownCapture}
        onPointerMoveCapture={onAnyPointerMoveCapture}
        onPointerUpCapture={onAnyPointerUpCapture}
        onClick={onSvgClick}
        onClickCapture={onSvgClickCapture}
        onMouseMove={onSvgMouseMove}
        onMouseLeave={onSvgMouseLeave}
        xmlns="http://www.w3.org/2000/svg"
        sx={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "auto",
        }}
      >
        {/* WORLD */}
        <g transform={`translate(${world.x}, ${world.y}) scale(${world.k})`}>
          {/* BG layer */}
          <g
            transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}
          >
            {showBgImage && (
              <NodeSvgImage
                src={bgImageUrl}
                dataNodeType="BG_IMAGE"
                dataNodeId={bgImageUrl}
                width={bgSize.w}
                height={bgSize.h}
                locked
              />
            )}
            {/* Render non-selected BG annotations first */}
            {bgImageAnnotations
              .filter((annotation) => annotation.id !== selectedNode?.id)
              .map((annotation) => (
                <NodeAnnotation
                  key={annotation.id}
                  annotation={annotation}
                  imageSize={bgSize}
                  containerK={bgPose.k}
                  worldScale={world.k}
                  onDragStart={handleAnnotationDragStart}
                  onDragEnd={handleAnnotationDragEnd}
                  onChange={handleAnnotationChange}
                  onClick={handleMarkerClick}
                  spriteImage={annotationSpriteImage}
                  selected={false}
                />
              ))}

            {/* Render selected BG annotation last (on top) */}
            {selectedNode?.id &&
              bgImageAnnotations
                .filter((annotation) => annotation.id === selectedNode.id)
                .map((annotation) => (
                  <NodeAnnotation
                    key={annotation.id}
                    annotation={annotation}
                    imageSize={bgSize}
                    containerK={bgPose.k}
                    worldScale={world.k}
                    onDragStart={handleAnnotationDragStart}
                    onDragEnd={handleAnnotationDragEnd}
                    onChange={handleAnnotationChange}
                    onClick={handleMarkerClick}
                    spriteImage={annotationSpriteImage}
                    selected={true}
                  />
                ))}
          </g>

          {/* BASE layer */}
          <g
            transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
          >
            <NodeSvgImage
              src={baseMapImageUrl}
              dataNodeType="BASE_MAP"
              dataNodeId={baseMapImageUrl}
              width={baseSize.w}
              height={baseSize.h}
              worldScale={world.k}
              containerK={basePose.k}
              onPoseChangeStart={() => setBasePoseIsChanging(true)}
              onPoseChangeEnd={handleBasePoseChange}
              selected={selectedNode?.nodeType === "BASE_MAP"}
              enabledDrawingMode={enabledDrawingMode}
              grayScale={baseMapGrayScale}
              opacity={baseMapOpacity}
            />

            {/* Rectangle drawing/preview */}
            {enabledDrawingMode === "RECTANGLE" &&
              drawingRectanglePoints &&
              drawingRectanglePoints.length > 0 && (
                <NodeRectangle
                  rectangle={{
                    points: drawingRectanglePoints,
                    ...(newRectangleProps ?? {}),
                  }}
                  imageSize={baseSize}
                  containerK={basePose.k}
                  worldScale={world.k}
                  baseMapMeterByPx={baseMapMeterByPx}
                  isDrawing={true}
                  isPreview={drawingRectanglePoints.length < 2}
                  toBaseFromClient={toBaseFromClient}
                />
              )}

            {/* Segment drawing/preview */}
            <NodeSegment
              imageSize={baseSize}
              containerPose={basePose}
              toBaseFromClient={toBaseFromClient}
              isDrawing={enabledDrawingMode === "SEGMENT"}
              segment={{
                points: drawingSegmentPoints,
                ...(newSegmentProps ?? {}),
              }}
              onComplete={onSegmentComplete}
              worldScale={world.k}
              containerK={basePose.k}
            />

            {!basePoseIsChanging && (
              <g>
                {/* Render non-selected annotations first */}
                {baseMapAnnotations
                  ?.filter((annotation) => annotation.id !== selectedNode?.id)
                  .map((annotation) => (
                    <NodeAnnotation
                      key={annotation.id}
                      annotation={annotation}
                      imageSize={baseSize}
                      baseMapMeterByPx={baseMapMeterByPx}
                      containerK={basePose.k}
                      worldScale={world.k}
                      onDragStart={handleAnnotationDragStart}
                      onDragEnd={handleAnnotationDragEnd}
                      onChange={handleAnnotationChange}
                      onClick={handleMarkerClick}
                      spriteImage={annotationSpriteImage}
                      selected={false}
                      toBaseFromClient={toBaseFromClient}
                    />
                  ))}

                {/* Render selected annotation last (on top) */}
                {selectedNode?.id &&
                  baseMapAnnotations
                    ?.filter((annotation) => annotation.id === selectedNode.id)
                    .map((annotation) => (
                      <NodeAnnotation
                        key={annotation.id}
                        annotation={annotation}
                        imageSize={baseSize}
                        baseMapMeterByPx={baseMapMeterByPx}
                        containerK={basePose.k}
                        worldScale={world.k}
                        onDragStart={handleAnnotationDragStart}
                        onDragEnd={handleAnnotationDragEnd}
                        onChange={handleAnnotationChange}
                        onClick={handleMarkerClick}
                        spriteImage={annotationSpriteImage}
                        selected={true}
                        toBaseFromClient={toBaseFromClient}
                      />
                    ))}
              </g>
            )}

            {/* Polyline drawing/preview - rendered last so it's on top of all annotations */}
            <NodePolyline
              imageSize={baseSize}
              containerPose={basePose}
              toBaseFromClient={toBaseFromClient}
              isDrawing={enabledDrawingMode === "POLYLINE"} // ← only when drawing
              polyline={{
                points: drawingPolylinePoints,
                ...(newPolylineProps ?? {}),
              }}
              onComplete={onPolylineComplete}
              worldScale={world.k}
              containerK={basePose.k}
              baseMapMeterByPx={baseMapMeterByPx}
              snapHelper={snapHelper}
            />
          </g>

          {/* LEGEND layer */}
          <g
            transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}
          >
            {legendItems && showBgImage && (
              <NodeLegend
                selected={selectedNode?.nodeType === "LEGEND"}
                legendItems={legendItems}
                spriteImage={annotationSpriteImage}
                legendFormat={legendFormat}
                onLegendFormatChange={handleLegendFormatChange}
                worldScale={world.k}
                containerK={bgPose.k}
              />
            )}
          </g>
        </g>
      </Box>

      {/* Export-only SVG */}
      <svg
        ref={ref}
        width={bgSize.w}
        height={bgSize.h}
        viewBox={`0 0 ${bgSize.w} ${bgSize.h}`}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          {showBgImage && (
            <NodeSvgImage src={bgImageUrl} width={bgSize.w} height={bgSize.h} />
          )}
          {bgImageAnnotations.map((a) => (
            <NodeAnnotation
              key={a.id + "_"}
              annotation={a}
              imageSize={bgSize}
              containerK={bgPose.k}
              worldScale={1}
              onDragEnd={() => {}}
              onClick={() => {}}
              spriteImage={annotationSpriteImage}
            />
          ))}
        </g>

        <g
          transform={`translate(${(basePose.x - bgPose.x) / (bgPose.k || 1)}, ${
            (basePose.y - bgPose.y) / (bgPose.k || 1)
          }) scale(${(basePose.k || 1) / (bgPose.k || 1)})`}
        >
          <NodeSvgImage
            src={baseMapImageUrl}
            width={baseSize.w}
            height={baseSize.h}
            grayScale={baseMapGrayScale}
            opacity={baseMapOpacity}
          />

          {baseMapAnnotations.map((a) => (
            <NodeAnnotation
              key={a.id + "_"}
              annotation={a}
              imageSize={baseSize}
              baseMapMeterByPx={baseMapMeterByPx}
              containerK={basePose.k}
              worldScale={1}
              onDragEnd={() => {}}
              onClick={() => {}}
              spriteImage={annotationSpriteImage}
            />
          ))}
        </g>

        <g>
          {legendItems?.length > 0 && showBgImage && (
            <NodeLegend
              id="legend-1"
              legendItems={legendItems}
              spriteImage={annotationSpriteImage}
              legendFormat={legendFormat}
              worldScale={1}
              containerK={1}
              selected={false}
            />
          )}
        </g>
      </svg>

      {/* Marker tooltip layer */}
      <LayerMarkerTooltip
        containerEl={containerRef.current}
        hoveredMarker={hoveredMarker}
        mousePos={mousePos}
        annotationSpriteImage={annotationSpriteImage}
      />
      <LayerAnnotationTooltip
        containerEl={containerRef.current}
        hoveredAnnotation={hoveredAnnotation}
        mousePos={mousePos}
      />
    </Box>
  );
});

export default MapEditorGeneric;

function projectPointOnSegment(px, py, seg) {
  const vx = seg.x2 - seg.x1;
  const vy = seg.y2 - seg.y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) {
    return { x: seg.x1, y: seg.y1 };
  }
  let t = ((px - seg.x1) * vx + (py - seg.y1) * vy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    x: seg.x1 + vx * t,
    y: seg.y1 + vy * t,
  };
}
