import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";

import { Box, Tooltip, IconButton } from "@mui/material";
import { CenterFocusStrong as CenterFocusStrongIcon } from "@mui/icons-material";

import NodeSvgImage from "./NodeSvgImage";
import NodeMarkerVariantDot from "./NodeMarkerVariantDot";

import clamp from "Features/misc/utils/clamp";

import {
  mFromTSR,
  mApply,
  mInverse,
  mMul,
} from "Features/matrix/utils/matrixHelpers";

export default function MapEditorGeneric({
  bgImageUrl,
  baseMapImageUrl,
  markers,
  initialScale = "fit",
  minScale = 0.1,
  maxScale = 10,
  attachTo = "bg", // "bg" or "base"
  showBgImage = true,
  cursor = "grab",
  enabledDrawingMode,
  onNewAnnotation,
  onAnnotationClick,
}) {
  // === REFS ===

  const containerRef = useRef();

  // prevent click after drag stops.
  const CLICK_DRAG_TOL = 5; // px   // 🔥 NEW
  const downRef = useRef({ x: 0, y: 0 }); // 🔥 NEW
  const movedRef = useRef(false); // 🔥 NEW
  const suppressNextClickRef = useRef(false); // 🔥 NEW

  // === STATES ===

  // === Viewport & world transform (world -> viewport) ===
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [world, setWorld] = useState({ x: 0, y: 0, k: 1 }); // translate + scale applied to the top <g>

  // === Intrinsic sizes (local coordinate systems of each image) ===
  const [bgSize, setBgSize] = useState({ w: 0, h: 0 });
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });

  // === Layer poses (local -> world) ===
  const [bgPose, setBgPose] = useState({ x: 0, y: 0, k: 1, r: 0 }); // bgImage positioned in world
  const [basePose, setBasePose] = useState({ x: 0, y: 0, k: 1, r: 0 }); // mainBaseMap positioned in world

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

  // Fit-to-view (based on bgImage by default)
  const fit = useCallback(() => {
    // Prefer the visible layer for fitting
    const W = (showBgImage ? bgSize.w : 0) || baseSize.w;
    const H = (showBgImage ? bgSize.h : 0) || baseSize.h;
    console.log("debug_0509 fit", W, H, viewport.w, viewport.h);
    //
    if (!W || !H || !viewport.w || !viewport.h) return;
    //
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
      // Prefer the visible layer when centering with a fixed scale
      const W = (showBgImage ? bgSize.w : 0) || baseSize.w;
      const H = (showBgImage ? bgSize.h : 0) || baseSize.h;
      const x = (viewport.w - W * k) / 2;
      const y = (viewport.h - H * k) / 2;
      setWorld({ x, y, k });
    }
  }, [initialScale, viewport, bgSize, baseSize, minScale, maxScale]);

  // === PANNING ===

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const onPointerDown = useCallback(
    (e) => {
      if (!containerRef.current) return;
      //containerRef.current.setPointerCapture(e.pointerId);
      setIsPanning(true);
      // to prevent click at drag stops
      downRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      //
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: world.x,
        ty: world.y,
      };
    },
    [world.x, world.y]
  );
  const onPointerMove = useCallback(
    (e) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;

      // 🔥 detect drag beyond tolerance
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
    [isPanning]
  );

  const endPan = useCallback((e) => {
    if (!containerRef.current) return;
    try {
      containerRef.current.releasePointerCapture(e.pointerId);
    } catch {}
    setIsPanning(false);
    // prevent click propagation after drag stop
    if (movedRef.current) suppressNextClickRef.current = true;
  }, []);

  // === ZOOM TO POINTER ===

  const zoomAt = useCallback(
    (clientX, clientY, factor) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const newK = clamp(world.k * factor, minScale, maxScale);
      // keep (px,py) stable: compute world point under cursor before/after
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

  // Add wheel event listener manually to ensure preventDefault works
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [onWheel]);

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

  // === CURSOR ===

  cursor = isPanning ? "grabbing" : cursor;

  // === CLICK ===

  // 🔥 capture-phase handler to suppress unwanted click
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
      console.log("debug_0809 SVG CLICK detected!", {
        isPanning,
        enabledDrawingMode,
        e,
      });
      if (isPanning) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      let p;
      if (attachTo === "bg") {
        p = screenToBgLocal(sx, sy);
      } else {
        p = screenToBaseLocal(sx, sy);
      }

      // Check if we're in marker creation mode
      if (enabledDrawingMode === "MARKER" && onNewAnnotation) {
        // Convert to ratio coordinates (0-1) relative to bgImage
        const ratioX = p.x / bgSize.w;
        const ratioY = p.y / bgSize.h;

        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(1, ratioX));
        const clampedY = Math.max(0, Math.min(1, ratioY));

        onNewAnnotation({
          type: "MARKER",
          x: clampedX,
          y: clampedY,
        });

        console.log("Marker created at:", { x: clampedX, y: clampedY });
        return;
      }

      console.log("debug_0509 onSvgClick", p);
    },
    [
      attachTo,
      isPanning,
      screenToBgLocal,
      screenToBaseLocal,
      enabledDrawingMode,
      onNewAnnotation,
      bgSize.w,
      bgSize.h,
    ]
  );

  // === DRAG ===

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback((markerId, newPosition) => {
    console.log("Marker drag ended:", { markerId, newPosition });
    // Here you would typically update the marker position in your state/store
    // For now, we'll just log the new position
  }, []);

  // === ANNOTATION EVENTS ===

  function handleMarkerClick(marker) {
    if (onAnnotationClick) onAnnotationClick({ type: "MARKER", ...marker });
  }

  return (
    <Box
      ref={containerRef}
      //onDoubleClick={onDoubleClick}
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
            onClick={fit}
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
          pointerEvents: "auto", // Ensure SVG can receive pointer events
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
              />
            )}
            <g>
              {/* {bgAnnots.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={6} fill="#9c27b0" />
              ))} */}

              {/* Markers positioned relative to bgImage */}
            </g>
          </g>

          {/* LAYER: mainBaseMap — moving/scaling this moves its annotations */}
          <g
            transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
          >
            <NodeSvgImage
              src={baseMapImageUrl}
              width={baseSize.w}
              height={baseSize.h}
            />
            <g>
              {markers?.map((marker) => {
                return (
                  <NodeMarkerVariantDot
                    key={marker.id}
                    marker={marker}
                    bgSize={bgSize}
                    bgPose={bgPose}
                    worldScale={world.k}
                    onDragEnd={handleMarkerDragEnd}
                    onClick={handleMarkerClick}
                  />
                );
              })}
            </g>
          </g>
        </g>
      </Box>
    </Box>
  );
}
