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
import NodeMarkerVariantDot from "./NodeMarkerVariantDot";
import NodeText from "./NodeText";
import NodePolygon from "./NodePolygon";
import NodeMarker from "./NodeMarker";
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
    markers,
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

  // === HELPERS ANNOTATIONS ===
  const textAnnotations = annotations?.filter((a) => a.type === "TEXT") ?? [];
  const polygonAnnotations =
    annotations?.filter((a) => a.type === "POLYGON") ?? [];
  const markerAnnotations =
    annotations?.filter((a) => a.type === "MARKER") ?? [];

  // === REFS ===
  const containerRef = useRef();

  // prevent click after drag stops.
  const CLICK_DRAG_TOL = 5;
  const downRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  // === STATES ===

  // === Viewport & world transform (world -> viewport) ===
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [world, setWorld] = useState({ x: 0, y: 0, k: 1 }); // translate + scale applied to the top <g>

  // === Intrinsic sizes (local coordinate systems of each image) ===
  const [bgSize, setBgSize] = useState({ w: 0, h: 0 });
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });

  // === Layer poses (local -> world) ===
  const [bgPose, setBgPose] = useState({ x: 0, y: 0, k: 1, r: 0 }); // bgImage positioned in world
  //const [basePoseState, setBasePoseState] = useState({ x: 0, y: 0, k: 1, r: 0 }); // (non utilisé)

  const basePose = {
    x: bgPose.x + (baseMapPoseInBg.x || 0) * (bgPose.k || 1),
    y: bgPose.y + (baseMapPoseInBg.y || 0) * (bgPose.k || 1),
    k: (bgPose.k || 1) * (baseMapPoseInBg.k || 1),
    r: (bgPose.r || 0) + (baseMapPoseInBg.r || 0),
  };

  // === positionning baseMap ===
  const [basePoseIsChanging, setBasePoseIsChanging] = useState(false);

  function handleBasePoseChangeStart() {
    setBasePoseIsChanging(true);
  }
  function handleBasePoseChangeEnd() {
    setBasePoseIsChanging(false);
  }

  // === SIZE EFFECTS ===

  // Load intrinsic sizes
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
    // Prefer the visible layer for fitting
    const W = (showBgImage ? bgSize.w : 0) || baseSize.w;
    const H = (showBgImage ? bgSize.h : 0) || baseSize.h;
    // console.log("debug fit", W, H, viewport.w, viewport.h);
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
  // 🟢 NEW: état & refs pour PINCH + INERTIE
  // ============================
  const [isPinching, setIsPinching] = useState(false); // 🟢 NEW
  const pointersRef = useRef(new Map()); // 🟢 NEW (pointerId -> {x,y})
  const pinchRef = useRef({
    // 🟢 NEW
    active: false,
    lastDist: 0,
    lastMid: { x: 0, y: 0 },
    lastT: 0,
  });
  const inertiaRef = useRef({
    // 🟢 NEW
    raf: null,
    zoomV: 0, // vitesse zoom ln(k)/ms
    panVX: 0, // px/ms
    panVY: 0, // px/ms
    pivotPx: 0, // pivot relatif au container
    pivotPy: 0,
    lastT: 0,
  });

  // 🟢 NEW: utilitaires pinch
  const getDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y); // 🟢 NEW
  const getMidpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); // 🟢 NEW
  const cancelInertia = useCallback(() => {
    // 🟢 NEW
    if (inertiaRef.current.raf) {
      cancelAnimationFrame(inertiaRef.current.raf);
      inertiaRef.current.raf = null;
    }
  }, []);

  // ============================
  // 🟢 NEW: boucle d’inertie (zoom + pan)
  // ============================
  const startInertia = useCallback(() => {
    // 🟢 NEW
    const MIN_ZOOMV = 1e-5; // seuil ln(k)/ms
    const MIN_PANV = 0.02; // px/ms

    let { zoomV, panVX, panVY, pivotPx, pivotPy } = inertiaRef.current;
    if (Math.abs(zoomV) < MIN_ZOOMV && Math.hypot(panVX, panVY) < MIN_PANV) {
      return;
    }

    const ZOOM_FRICTION = 0.0025; // friction zoom (par ms)
    const PAN_FRICTION = 0.003; // friction pan (par ms)

    const step = (t) => {
      const ref = inertiaRef.current;
      const lastT = ref.lastT || t;
      const dt = Math.max(0, t - lastT);
      ref.lastT = t;

      // Décroissance
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

      ref.raf = requestAnimationFrame(step);
    };

    inertiaRef.current.lastT = performance.now();
    inertiaRef.current.raf = requestAnimationFrame(step);
  }, [cancelInertia, minScale, maxScale]);

  // === PANNING ===

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const onPointerDown = useCallback(
    (e) => {
      if (!containerRef.current) return;

      cancelInertia(); // 🟢 NEW: toute nouvelle interaction annule l’inertie

      // Gestion multi-pointeurs pour pinch
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); // 🟢 NEW
      const count = pointersRef.current.size; // 🟢 NEW

      if (count === 2) {
        // 🟢 NEW: démarrage du pinch
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
      // garder la position des pointeurs pour le pinch
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); // 🟢 NEW
      }

      // 🟢 NEW: PINCH (2 doigts)
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

        // Zoom autour du milieu
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

        // Pan pour suivre le midpoint
        const dxMid = mid.x - pinchRef.current.lastMid.x;
        const dyMid = mid.y - pinchRef.current.lastMid.y;
        if (dxMid || dyMid) {
          setWorld((t) => ({ ...t, x: t.x + dxMid, y: t.y + dyMid }));
        }

        // Vitesse pour inertie
        const vZoom = Math.log(factor) / dt; // ln(k)/ms
        const vX = dxMid / dt; // px/ms
        const vY = dyMid / dt; // px/ms
        inertiaRef.current.zoomV = isFinite(vZoom) ? vZoom : 0;
        inertiaRef.current.panVX = isFinite(vX) ? vX : 0;
        inertiaRef.current.panVY = isFinite(vY) ? vY : 0;

        pinchRef.current.lastDist = dist;
        pinchRef.current.lastMid = mid;
        pinchRef.current.lastT = now;
        return;
      }

      // PAN à 1 doigt (inchangé)
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
    [isPinching, isPanning, minScale, maxScale, world.k, world.x, world.y]
  );

  const endPan = useCallback(
    (e) => {
      if (!containerRef.current) return;

      // 🟢 NEW: maj du set de pointeurs
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.delete(e.pointerId);
      }
      const count = pointersRef.current.size;

      if (isPinching) {
        if (count >= 2) return;
        // Fin du pinch : lancer inertie
        setIsPinching(false);
        pinchRef.current.active = false;

        const rect = containerRef.current.getBoundingClientRect();
        const mid = pinchRef.current.lastMid;
        inertiaRef.current.pivotPx = mid.x - rect.left;
        inertiaRef.current.pivotPy = mid.y - rect.top;
        inertiaRef.current.lastT = performance.now();

        startInertia(); // 🟢 NEW

        if (count === 1) {
          const [p] = Array.from(pointersRef.current.values());
          setIsPanning(true);
          panStart.current = { x: p.x, y: p.y, tx: world.x, ty: world.y };
          return;
        }
      }

      if (count === 0) {
        setIsPanning(false);
        if (movedRef.current) suppressNextClickRef.current = true;
      }
    },
    [isPinching, startInertia, world.x, world.y]
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
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(e.clientX, e.clientY, factor);
    },
    [zoomAt, cancelInertia]
  );

  // Add wheel event listener manually to ensure preventDefault works
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
      cancelInertia(); // 🟢 NEW
    };
  }, [onWheel, cancelInertia]);

  // === MATRICES FOR CONVERSIONS ===

  // world->viewport
  const Mvw = useMemo(() => mFromTSR(world.x, world.y, world.k, 0), [world]);

  // bg local->world
  const Mbg = useMemo(
    () => mFromTSR(bgPose.x, bgPose.y, bgPose.k, bgPose.r),
    [bgPose]
  );

  // base local->world
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

  // ...compute relative transform base->bg (r == 0 assumed)
  const relBase = useMemo(() => {
    const kbg = bgPose.k || 1;
    return {
      x: (basePose.x - bgPose.x) / kbg,
      y: (basePose.y - bgPose.y) / kbg,
      k: (basePose.k || 1) / kbg,
    };
  }, [bgPose, basePose]);

  // === CURSOR ===
  cursor = isPinching ? "grabbing" : isPanning ? "grabbing" : cursor; // 🟢 NEW

  // === CLICK ===

  const onSvgClickCapture = useCallback((e) => {
    if (suppressNextClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false; // reset for next click
    }
  }, []);

  // Click to add an annotation to the selected layer
  const onSvgClick = useCallback(
    (e) => {
      if (isPanning || isPinching) return; // 🟢 NEW: pas de click pendant gestes

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
        onNewAnnotation({
          type: "MARKER",
          x: ratioX,
          y: ratioY,
        });
        return;
      }
    },
    [
      attachTo,
      isPanning,
      isPinching, // 🟢 NEW
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

  // === DRAG ===

  const handleMarkerDragEnd = useCallback((markerId, newPosition) => {
    // Update as needed
    // console.log("Marker drag ended:", { markerId, newPosition });
  }, []);

  // === ANNOTATION EVENTS ===

  function handleMarkerClick(marker) {
    if (onAnnotationClick) onAnnotationClick({ type: "MARKER", ...marker });
  }

  function handleAnnotationChange(annotation) {
    if (onAnnotationChange) onAnnotationChange(annotation);
  }

  function handleAnnotationDragEnd(annotation) {
    if (onAnnotationDragEnd) onAnnotationDragEnd(annotation);
  }

  function handleAnnotationClick(annotation) {
    if (onAnnotationClick) onAnnotationClick({ annotation });
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
        touchAction: "none", // important pour gestes pointer (pinch) 🟢 NEW (déjà présent)
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
        <Tooltip title="Fit to view">
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
        </Tooltip>
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
        {/* WORLD group — applies viewport pan/zoom to everything */}
        <g transform={`translate(${world.x}, ${world.y}) scale(${world.k})`}>
          {/* LAYER: bgImage — annotations inside are in bg local coords */}
          <g
            transform={`translate(${bgPose.x}, ${bgPose.y}) scale(${bgPose.k})`}
          >
            {showBgImage && (
              <NodeSvgImage
                src={bgImageUrl}
                width={bgSize.w}
                height={bgSize.h}
                locked={true}
              />
            )}
            <g>{/* place for bg-attached annotations if any */}</g>
          </g>

          {/* LAYER: mainBaseMap — moving/scaling this moves its annotations */}
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
                // compose in parent: P' = P ∘ delta (bg-local)
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
                {annotations?.map((annotation) => {
                  return (
                    <NodeAnnotation
                      key={annotation.id}
                      annotation={annotation}
                      imageSize={baseSize}
                      containerK={basePose.k}
                      worldScale={world.k}
                      onDragEnd={handleMarkerDragEnd}
                      onClick={handleMarkerClick}
                      spriteImage={annotationSpriteImage}
                      selected={selectedAnnotationIds.includes(annotation.id)}
                    />
                  );
                })}
              </g>
            )}
          </g>
        </g>
      </Box>

      {/* ===== Hidden export-only SVG (normalized to bg size) ===== */}
      <svg
        ref={ref}
        width={bgSize.w}
        height={bgSize.h}
        viewBox={`0 0 ${bgSize.w} ${bgSize.h}`}
        style={{
          position: "absolute",
          left: 0, // si tu dois l’exporter, évite left:-99999 avec html-to-image
          top: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* BG layer in bg-local coords (identity pose) */}
        <g>
          {showBgImage && (
            <NodeSvgImage src={bgImageUrl} width={bgSize.w} height={bgSize.h} />
          )}
        </g>

        {/* BASE layer expressed relative to BG */}
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
          {annotations.map((pa) => (
            <NodeAnnotation
              key={pa.id + "_"}
              annotation={pa}
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
