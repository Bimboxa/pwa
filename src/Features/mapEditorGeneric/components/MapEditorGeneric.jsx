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

import NodeSvgImage from "./NodeSvgImage";
import NodeAnnotation from "./NodeAnnotation";
import NodeLegend from "./NodeLegend";
import NodePolyline from "./NodePolyline";
import NodeRectangle from "./NodeRectangle";
import LayerMarkerTooltip from "Features/mapEditor/components/LayerMarkerTooltip";
import DraggableFabMarker from "Features/markers/components/DraggableFabMarker";

import clamp from "Features/misc/utils/clamp";
import {
  mFromTSR,
  mApply,
  mInverse,
  mMul,
} from "Features/matrix/utils/matrixHelpers";

import { useDispatch } from "react-redux";
import {
  addPolylinePoint,
  addRectanglePoint,
} from "Features/mapEditor/mapEditorSlice";

const MapEditorGeneric = forwardRef(function MapEditorGeneric(props, ref) {
  let {
    isMobile,
    bgImageUrl,
    baseMapImageUrl,
    baseMapPoseInBg, // {x:0,y:0,k:1,r:0}, pose of baseMap in bg local coords.
    onBaseMapPoseInBgChange,
    annotations,
    initialScale = "fit",
    minScale = 0.1,
    maxScale = 10,
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
    legendItems,
    legendFormat,
    onLegendFormatChange,

    // polyline
    onPolylineComplete,
    drawingPolylinePoints, // Array<{x,y}> in relative coords
    newPolylineProps,

    // rectangle
    onRectangleComplete,
    drawingRectanglePoints, // Array<{x,y}> with max 2 points
    newRectangleProps,
  } = props;

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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);

  const basePose = {
    x: bgPose.x + (baseMapPoseInBg.x || 0) * (bgPose.k || 1),
    y: bgPose.y + (baseMapPoseInBg.y || 0) * (bgPose.k || 1),
    k: (bgPose.k || 1) * (baseMapPoseInBg.k || 1),
    r: (bgPose.r || 0) + (baseMapPoseInBg.r || 0),
  };

  const [basePoseIsChanging, setBasePoseIsChanging] = useState(false);

  // === Load sizes
  useEffect(() => {
    if (!bgImageUrl) return;
    const img = new Image();
    img.onload = () => setBgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = bgImageUrl;
  }, [bgImageUrl]);

  useEffect(() => {
    if (!baseMapImageUrl) return;
    const img = new Image();
    img.onload = () =>
      setBaseSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = baseMapImageUrl;
  }, [baseMapImageUrl]);

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

  // === INIT VIEWPORT ===

  const fit = useCallback(() => {
    const W = (showBgImage ? bgSize.w : 0) || baseSize.w;
    const H = (showBgImage ? bgSize.h : 0) || baseSize.h;
    if (!W || !H || !viewport.w || !viewport.h) return;
    const scale = Math.min(viewport.w / W, viewport.h / H) || 1;
    const k = clamp(scale, minScale, maxScale);
    const x = (viewport.w - W * k) / 2;
    const y = (viewport.h - H * k) / 2;
    setWorld({ x, y, k });
  }, [bgSize, baseSize, viewport, minScale, maxScale, showBgImage]);

  useEffect(() => {
    if (initialScale === "fit") fit();
    else if (typeof initialScale === "number") {
      const k = clamp(initialScale, minScale, maxScale);
      const W = (showBgImage ? bgSize.w : 0) || baseSize.w;
      const H = (showBgImage ? bgSize.h : 0) || baseSize.h;
      const x = (viewport.w - W * k) / 2;
      const y = (viewport.h - H * k) / 2;
      setWorld({ x, y, k });
    }
  }, [initialScale, viewport, bgSize, baseSize, minScale, maxScale, fit, showBgImage]);

  // ============================
  // 🟢 PINCH + INERTIA
  // ============================

  const MIN_ZOOMV = 5e-5;
  const MIN_PANV = 0.02;
  const ZOOM_FRICTION = 0.0018;
  const PAN_FRICTION = 0.002;
  const PAN_SMOOTHING = 0.25;
  const WHEEL_INERTIA_DELAY = 90;

  const [isPinching, setIsPinching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const pointersRef = useRef(new Map());
  const pinchRef = useRef({
    active: false,
    lastDist: 0,
    lastMid: { x: 0, y: 0 },
    lastT: 0,
  });

  const inertiaRef = useRef({
    raf: null,
    zoomV: 0,
    panVX: 0,
    panVY: 0,
    pivotPx: 0,
    pivotPy: 0,
    lastT: 0,
  });

  const panSpeedRef = useRef({
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vX: 0,
    vY: 0,
  });

  const wheelRef = useRef({
    timer: null,
    lastT: 0,
    lastPivot: { x: 0, y: 0 },
    vZoom: 0,
  });

  const cancelInertia = useCallback(() => {
    if (inertiaRef.current.raf) {
      cancelAnimationFrame(inertiaRef.current.raf);
      inertiaRef.current.raf = null;
    }
  }, []);

  const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const getMidpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const startInertia = useCallback(() => {
    let { zoomV, panVX, panVY, pivotPx, pivotPy } = inertiaRef.current;

    if (Math.abs(zoomV) < MIN_ZOOMV && Math.hypot(panVX, panVY) < MIN_PANV) {
      return;
    }

    const step = (t) => {
      const ref = inertiaRef.current;
      const lastT = ref.lastT || t;
      const dt = Math.max(0, t - lastT);
      ref.lastT = t;

      zoomV *= Math.exp(-ZOOM_FRICTION * dt);
      panVX *= Math.exp(-PAN_FRICTION * dt);
      panVY *= Math.exp(-PAN_FRICTION * dt);

      if (Math.abs(zoomV) < MIN_ZOOMV && Math.hypot(panVX, panVY) < MIN_PANV) {
        cancelInertia();
        return;
      }

      const factor = Math.exp(zoomV * dt);

      setWorld((prev) => {
        const newK = clamp(prev.k * factor, minScale, maxScale);

        const wx = (pivotPx - prev.x) / prev.k;
        const wy = (pivotPy - prev.y) / prev.k;
        let newX = pivotPx - wx * newK;
        let newY = pivotPy - wy * newK;

        newX += panVX * dt;
        newY += panVY * dt;

        return { x: newX, y: newY, k: newK };
      });

      ref.zoomV = zoomV;
      ref.panVX = panVX;
      ref.panVY = panVY;
      ref.raf = requestAnimationFrame(step);
    };

    inertiaRef.current.lastT = performance.now();
    inertiaRef.current.raf = requestAnimationFrame(step);
  }, [
    MIN_ZOOMV,
    MIN_PANV,
    ZOOM_FRICTION,
    PAN_FRICTION,
    minScale,
    maxScale,
    cancelInertia,
  ]);

  // === PANNING / GESTURES ===
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const onPointerDown = useCallback(
    (e) => {
      if (!containerRef.current) return;

      cancelInertia();

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const count = pointersRef.current.size;

      panSpeedRef.current.vX = 0;
      panSpeedRef.current.vY = 0;
      panSpeedRef.current.lastX = e.clientX;
      panSpeedRef.current.lastY = e.clientY;
      panSpeedRef.current.lastT = performance.now();

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
          lastT: performance.now(),
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
    [world.x, world.y, cancelInertia]
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

        const now = performance.now();
        const dt = Math.max(1, now - pinchRef.current.lastT);

        const factor =
          dist > 0 && pinchRef.current.lastDist > 0
            ? dist / pinchRef.current.lastDist
            : 1;

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && factor !== 1) {
          const px = mid.x - rect.left;
          const py = mid.y - rect.top;

          const newK = clamp(world.k * factor, minScale, maxScale);
          const wx = (px - world.x) / world.k;
          const wy = (py - world.y) / world.k;
          const newX = px - wx * newK;
          const newY = py - wy * newK;
          setWorld({ x: newX, y: newY, k: newK });
        }

        const dxMid = mid.x - pinchRef.current.lastMid.x;
        const dyMid = mid.y - pinchRef.current.lastMid.y;
        if (dxMid || dyMid) {
          setWorld((t) => ({ ...t, x: t.x + dxMid, y: t.y + dyMid }));
        }

        const vZoom = Math.log(factor) / dt;
        const vX = dxMid / dt;
        const vY = dyMid / dt;
        inertiaRef.current.zoomV = isFinite(vZoom) ? vZoom : 0;
        inertiaRef.current.panVX = isFinite(vX) ? vX : 0;
        inertiaRef.current.panVY = isFinite(vY) ? vY : 0;

        pinchRef.current.lastDist = dist;
        pinchRef.current.lastMid = mid;
        pinchRef.current.lastT = now;
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

      const now = performance.now();
      const dt = Math.max(1, now - panSpeedRef.current.lastT);
      const instVX = (e.clientX - panSpeedRef.current.lastX) / dt;
      const instVY = (e.clientY - panSpeedRef.current.lastY) / dt;

      panSpeedRef.current.vX =
        panSpeedRef.current.vX * (1 - PAN_SMOOTHING) + instVX * PAN_SMOOTHING;
      panSpeedRef.current.vY =
        panSpeedRef.current.vY * (1 - PAN_SMOOTHING) + instVY * PAN_SMOOTHING;

      panSpeedRef.current.lastX = e.clientX;
      panSpeedRef.current.lastY = e.clientY;
      panSpeedRef.current.lastT = now;
    },
    [isPinching, isPanning, minScale, maxScale, world.k, world.x, world.y]
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

        const rect = containerRef.current.getBoundingClientRect();
        const mid = pinchRef.current.lastMid;
        inertiaRef.current.pivotPx = mid.x - rect.left;
        inertiaRef.current.pivotPy = mid.y - rect.top;
        inertiaRef.current.lastT = performance.now();
        startInertia();

        if (count === 1) {
          const [p] = Array.from(pointersRef.current.values());
          setIsPanning(true);
          panStart.current = { x: p.x, y: p.y, tx: world.x, ty: world.y };
          panSpeedRef.current.vX = 0;
          panSpeedRef.current.vY = 0;
          panSpeedRef.current.lastX = p.x;
          panSpeedRef.current.lastY = p.y;
          panSpeedRef.current.lastT = performance.now();
          return;
        }
      } else {
        if (count === 0) {
          setIsPanning(false);
          if (movedRef.current) suppressNextClickRef.current = true;

          const vX = panSpeedRef.current.vX;
          const vY = panSpeedRef.current.vY;

          if (Math.hypot(vX, vY) >= MIN_PANV) {
            inertiaRef.current.zoomV = 0;
            inertiaRef.current.panVX = vX;
            inertiaRef.current.panVY = vY;

            const rect = containerRef.current.getBoundingClientRect();
            inertiaRef.current.pivotPx = e.clientX - rect.left;
            inertiaRef.current.pivotPy = e.clientY - rect.top;
            inertiaRef.current.lastT = performance.now();

            startInertia();
          }
        }
      }
    },
    [isPinching, startInertia, world.x, world.y, MIN_PANV]
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
      cancelInertia();

      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(e.clientX, e.clientY, factor);

      const now = performance.now();
      const vZoomSample =
        Math.log(factor) /
        Math.max(1, now - (wheelRef.current.lastT || now - 16));

      wheelRef.current.vZoom = isFinite(vZoomSample) ? vZoomSample : 0;
      wheelRef.current.lastT = now;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        wheelRef.current.lastPivot = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }

      if (wheelRef.current.timer) clearTimeout(wheelRef.current.timer);
      wheelRef.current.timer = setTimeout(() => {
        if (Math.abs(wheelRef.current.vZoom) >= MIN_ZOOMV) {
          inertiaRef.current.zoomV = wheelRef.current.vZoom;
          inertiaRef.current.panVX = 0;
          inertiaRef.current.panVY = 0;
          inertiaRef.current.pivotPx = wheelRef.current.lastPivot.x;
          inertiaRef.current.pivotPy = wheelRef.current.lastPivot.y;
          inertiaRef.current.lastT = performance.now();
          startInertia();
        }
      }, WHEEL_INERTIA_DELAY);
    },
    [zoomAt, cancelInertia, MIN_ZOOMV, startInertia]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      cancelInertia();
      if (wheelRef.current.timer) clearTimeout(wheelRef.current.timer);
    };
  }, [onWheel, cancelInertia]);

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
  const screenToBaseLocal = useCallback(
    (sx, sy) => {
      const inv = mInverse(mMul(Mvw, Mbase));
      return mApply(inv, sx, sy);
    },
    [Mvw, Mbase]
  );

  const relBase = useMemo(() => {
    const kbg = bgPose.k || 1;
    return {
      x: (basePose.x - bgPose.x) / kbg,
      y: (basePose.y - bgPose.y) / kbg,
      k: (basePose.k || 1) / kbg,
    };
  }, [bgPose, basePose]);

  cursor = isPinching ? "grabbing" : isPanning ? "grabbing" : cursor;

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

      // Don't show tooltip while dragging an annotation
      if (isDraggingAnnotation) {
        setHoveredMarker(null);
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
          return;
        }
      }

      setHoveredMarker(null);
    },
    [annotations, updateMousePosition, isDraggingAnnotation]
  );

  const onSvgMouseLeave = useCallback(() => {
    setHoveredMarker(null);
  }, []);

  const dispatch = useDispatch();

  // === DRAG AND DROP HANDLERS ===
  const onDragOver = useCallback(
    (e) => {
      if (enabledDrawingMode === "MARKER") {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [enabledDrawingMode]
  );

  const onDrop = useCallback(
    (e) => {
      if (enabledDrawingMode !== "MARKER") return;

      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

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
    ]
  );

  const onMarkerDropped = useCallback(
    (event) => {
      console.log("dropped", event);
    },
    [screenToBgLocal, screenToBaseLocal]
  );

  const onSvgClick = useCallback(
    (e) => {
      if (isPanning || isPinching) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const p_inBg = screenToBgLocal(sx, sy);
      const p_inBase = screenToBaseLocal(sx, sy);

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
        // always use BASE layer for polyline points
        let bx = p_inBase.x;
        let by = p_inBase.y;

        // Apply the SAME Shift constraint as the preview (against the LAST committed point)
        const last = drawingPolylinePoints?.[drawingPolylinePoints.length - 1];
        if (e.shiftKey && last) {
          const lastPx = {
            x: (baseSize.w || 1) * last.x,
            y: (baseSize.h || 1) * last.y,
          };
          const dx = bx - lastPx.x;
          const dy = by - lastPx.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            // horizontal snap
            by = lastPx.y;
          } else {
            // vertical snap
            bx = lastPx.x;
          }
        }

        // Clamp to image bounds and convert to relative
        const ratioX = Math.max(0, Math.min(1, bx / (baseSize.w || 1)));
        const ratioY = Math.max(0, Math.min(1, by / (baseSize.h || 1)));

        dispatch(addPolylinePoint({ x: ratioX, y: ratioY }));
        return;
      }

      // ----- RECTANGLE MODE (2-click drawing) -----
      if (enabledDrawingMode === "RECTANGLE") {
        // always use BASE layer for rectangle points
        const bx = p_inBase.x;
        const by = p_inBase.y;

        // Clamp to image bounds and convert to relative
        const ratioX = Math.max(0, Math.min(1, bx / (baseSize.w || 1)));
        const ratioY = Math.max(0, Math.min(1, by / (baseSize.h || 1)));

        const currentPointCount = drawingRectanglePoints?.length || 0;

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
      {isMobile && (
        <Box
          sx={{
            position: "absolute",
            right: "8px",
            top: "8px",
            zIndex: 2,
          }}
        >
          <DraggableFabMarker bgcolor={"red"} onDropped={onMarkerDropped} />
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
              cancelInertia();
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
            />

            {/* Polyline drawing/preview */}
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
                  isDrawing={true}
                  isPreview={drawingRectanglePoints.length < 2}
                  toBaseFromClient={toBaseFromClient}
                />
              )}

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
          />

          {baseMapAnnotations.map((a) => (
            <NodeAnnotation
              key={a.id + "_"}
              annotation={a}
              imageSize={baseSize}
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
    </Box>
  );
});

export default MapEditorGeneric;
