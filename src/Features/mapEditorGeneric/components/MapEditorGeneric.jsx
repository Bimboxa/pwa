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

import clamp from "Features/misc/utils/clamp";
import {
  mFromTSR,
  mApply,
  mInverse,
  mMul,
} from "Features/matrix/utils/matrixHelpers";

const MapEditorGeneric = forwardRef(function MapEditorGeneric(props, ref) {
  let {
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
    onNewAnnotation,
    onAnnotationClick,
    onAnnotationChange,
    onAnnotationDragEnd,
    annotationSpriteImage,
    selectedAnnotationIds = [],
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
  // 🟢 NEW: PINCH + INERTIE
  // ============================

  // Constantes ajustées pour “sentir” l’inertie avec grandes images
  const MIN_ZOOMV = 5e-5; // seuil ln(k)/ms pour stopper l’inertie (un poil plus haut qu’avant)  // 🟢 NEW
  const MIN_PANV = 0.02; // px/ms (idem)                                                       // 🟢 NEW
  const ZOOM_FRICTION = 0.0018; // friction zoom par ms (plus faible -> inertie plus visible)        // 🟢 NEW
  const PAN_FRICTION = 0.002; // friction pan par ms                                                // 🟢 NEW
  const PAN_SMOOTHING = 0.25; // IIR alpha pour lisser la vitesse pan                               // 🟢 NEW
  const WHEEL_INERTIA_DELAY = 90; // ms sans wheel pour déclencher l’inertie de zoom                    // 🟢 NEW

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
    zoomV: 0, // ln(k)/ms
    panVX: 0, // px/ms
    panVY: 0, // px/ms
    pivotPx: 0, // pivot (px dans le container)
    pivotPy: 0,
    lastT: 0,
  });

  // 🟢 NEW: suivi vitesse de pan (1 doigt / souris)
  const panSpeedRef = useRef({
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vX: 0, // vitesse lissée px/ms
    vY: 0,
  });

  // 🟢 NEW: suivi wheel pour inertie zoom
  const wheelRef = useRef({
    timer: null,
    lastT: 0,
    lastPivot: { x: 0, y: 0 }, // dernier point souris
    vZoom: 0, // ln(k)/ms (échantillon récent)
  });

  const cancelInertia = useCallback(() => {
    if (inertiaRef.current.raf) {
      cancelAnimationFrame(inertiaRef.current.raf);
      inertiaRef.current.raf = null;
    }
  }, []);

  const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const getMidpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // 🟢 NEW: boucle d’inertie
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

      // Décroissance exponentielle
      zoomV *= Math.exp(-ZOOM_FRICTION * dt);
      panVX *= Math.exp(-PAN_FRICTION * dt);
      panVY *= Math.exp(-PAN_FRICTION * dt);

      // Arret si vitesses très faibles
      if (Math.abs(zoomV) < MIN_ZOOMV && Math.hypot(panVX, panVY) < MIN_PANV) {
        cancelInertia();
        return;
      }

      // Application
      const factor = Math.exp(zoomV * dt);

      setWorld((prev) => {
        const newK = clamp(prev.k * factor, minScale, maxScale);

        // Pivot zoom
        const wx = (pivotPx - prev.x) / prev.k;
        const wy = (pivotPy - prev.y) / prev.k;
        let newX = pivotPx - wx * newK;
        let newY = pivotPy - wy * newK;

        // Pan inertiel
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

      cancelInertia(); // 🟢 NEW

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const count = pointersRef.current.size;

      // init vitesses pan
      panSpeedRef.current.vX = 0; // 🟢 NEW
      panSpeedRef.current.vY = 0; // 🟢 NEW
      panSpeedRef.current.lastX = e.clientX; // 🟢 NEW
      panSpeedRef.current.lastY = e.clientY; // 🟢 NEW
      panSpeedRef.current.lastT = performance.now(); // 🟢 NEW

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

        // pan suiveur
        const dxMid = mid.x - pinchRef.current.lastMid.x;
        const dyMid = mid.y - pinchRef.current.lastMid.y;
        if (dxMid || dyMid) {
          setWorld((t) => ({ ...t, x: t.x + dxMid, y: t.y + dyMid }));
        }

        // vitesses pour inertie
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

      // PAN à 1 doigt / souris
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

      // position
      setWorld((t) => ({
        ...t,
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      }));

      // 🟢 NEW: vitesse lissée
      const now = performance.now();
      const dt = Math.max(1, now - panSpeedRef.current.lastT);
      const instVX = (e.clientX - panSpeedRef.current.lastX) / dt; // px/ms
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

      // maj du set de pointeurs
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.delete(e.pointerId);
      }
      const count = pointersRef.current.size;

      if (isPinching) {
        if (count >= 2) return;
        // Fin du pinch → inertie avec vitesses calculées
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
          // reset vitesses pan
          panSpeedRef.current.vX = 0;
          panSpeedRef.current.vY = 0;
          panSpeedRef.current.lastX = p.x;
          panSpeedRef.current.lastY = p.y;
          panSpeedRef.current.lastT = performance.now();
          return;
        }
      } else {
        // 🟢 NEW: fin de pan à 1 doigt/souris → inertie pan
        if (count === 0) {
          setIsPanning(false);
          if (movedRef.current) suppressNextClickRef.current = true;

          // Seuils : si vitesse suffisante → inertie
          const vX = panSpeedRef.current.vX;
          const vY = panSpeedRef.current.vY;

          if (Math.hypot(vX, vY) >= MIN_PANV) {
            inertiaRef.current.zoomV = 0; // pas d'inertie zoom
            inertiaRef.current.panVX = vX;
            inertiaRef.current.panVY = vY;

            // pivot quelconque (non utilisé sans zoom), on prend le pointeur
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
      cancelInertia(); // 🟢 NEW

      // zoom direct
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(e.clientX, e.clientY, factor);

      // 🟢 NEW: préparer inertie de zoom après la fin du wheel
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
        // Si échantillon de zoom significatif → inertie
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

  // === CLICK ===
  const onSvgClickCapture = useCallback((e) => {
    if (suppressNextClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false;
    }
  }, []);

  const onSvgClick = useCallback(
    (e) => {
      if (isPanning || isPinching) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      let p, ratioX, ratioY;
      if (attachTo === "bg") {
        p = screenToBgLocal(sx, sy);
        ratioX = p.x / bgSize.w;
        ratioY = p.y / bgSize.h;
      } else {
        p = screenToBaseLocal(sx, sy);
        ratioX = p.x / baseSize.w;
        ratioY = p.y / baseSize.h;
      }

      if (enabledDrawingMode === "MARKER" && onNewAnnotation) {
        onNewAnnotation({ type: "MARKER", x: ratioX, y: ratioY });
      }
    },
    [
      attachTo,
      isPanning,
      isPinching,
      screenToBgLocal,
      screenToBaseLocal,
      enabledDrawingMode,
      onNewAnnotation,
      bgSize.w,
      bgSize.h,
      baseSize.w,
      baseSize.h,
    ]
  );

  // === ANNOTATION EVENTS ===
  function handleMarkerClick(annotation) {
    onAnnotationClick?.(annotation);
  }
  function handleAnnotationChange(annotation) {
    onAnnotationChange?.(annotation);
  }
  function handleAnnotationDragEnd(annotation) {
    onAnnotationDragEnd?.(annotation);
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
        touchAction: "none", // indispensable pour pinch
        userSelect: "none",
        cursor,
      }}
    >
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
              cancelInertia(); // 🟢 NEW
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
        onClick={onSvgClick}
        onClickCapture={onSvgClickCapture}
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
                width={bgSize.w}
                height={bgSize.h}
                locked
              />
            )}
          </g>

          {/* BASE layer */}
          <g
            transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
          >
            <NodeSvgImage
              src={baseMapImageUrl}
              width={baseSize.w}
              height={baseSize.h}
              worldScale={world.k}
              containerK={basePose.k}
              onPoseChangeStart={() => setBasePoseIsChanging(true)}
              onPoseChangeEnd={(delta) => {
                const P = baseMapPoseInBg;
                onBaseMapPoseInBgChange?.({
                  x: P.x + delta.x,
                  y: P.y + delta.y,
                  k: P.k * delta.k,
                });
                setBasePoseIsChanging(false);
              }}
              enabledDrawingMode={enabledDrawingMode}
            />

            {!basePoseIsChanging && (
              <g>
                {annotations?.map((annotation) => (
                  <NodeAnnotation
                    key={annotation.id}
                    annotation={annotation}
                    imageSize={baseSize}
                    containerK={basePose.k}
                    worldScale={world.k}
                    onDragEnd={handleAnnotationDragEnd}
                    onClick={handleMarkerClick}
                    spriteImage={annotationSpriteImage}
                    selected={selectedAnnotationIds.includes(annotation.id)}
                  />
                ))}
              </g>
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
          {annotations.map((a) => (
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
      </svg>
    </Box>
  );
});

export default MapEditorGeneric;
