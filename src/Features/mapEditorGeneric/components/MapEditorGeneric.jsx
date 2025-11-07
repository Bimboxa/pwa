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
import NodeSegment from "./NodeSegment";
import LayerMarkerTooltip from "Features/mapEditor/components/LayerMarkerTooltip";
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
} from "Features/mapEditor/mapEditorSlice";
import applyFixedLengthConstraint from "Features/mapEditorGeneric/utils/applyFixedLengthConstraint";

const PADDING = 15;

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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [isDraggingFabMarker, setIsDraggingFabMarker] = useState(false);

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

  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);

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

        // Clamp to image bounds and convert to relative
        const ratioX = Math.max(0, Math.min(1, bx / (baseSize.w || 1)));
        const ratioY = Math.max(0, Math.min(1, by / (baseSize.h || 1)));

        dispatch(addPolylinePoint({ x: ratioX, y: ratioY }));
        dispatch(setFixedLength(""));
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
              baseMapMeterByPx={baseMapMeterByPx}
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
    </Box>
  );
});

export default MapEditorGeneric;
