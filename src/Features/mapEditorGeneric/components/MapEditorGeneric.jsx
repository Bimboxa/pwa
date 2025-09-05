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

import clamp from "Features/misc/utils/clamp";

import {
  mFromTSR,
  mApply,
  mInverse,
} from "Features/matrix/utils/matrixHelpers";

export default function MapEditorGeneric({
  bgImageUrl,
  baseMapImageUrl,
  initialScale = "fit",
  minScale = 0.1,
  maxScale = 10,
  attachTo = "bg", // "bg" or "base"
  showBgImage = true,
}) {
  // refs

  const containerRef = useRef();

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
      containerRef.current.setPointerCapture(e.pointerId);
      setIsPanning(true);
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

  const cursor = isPanning ? "grabbing" : "grab";

  // === CLICK ===

  // Click to add an annotation to the selected layer
  const onSvgClick = useCallback(
    (e) => {
      if (isPanning) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      let p;
      if (attachTo === "bg") {
        p = screenToBgLocal(sx, sy);
        //setBgAnnots((arr) => [...arr, { x: p.x, y: p.y }]);
      } else {
        p = screenToBaseLocal(sx, sy);
        //setBaseAnnots((arr) => [...arr, { x: p.x, y: p.y }]);
      }
      console.log("debug_0509 onSvgClick", p);
    },
    [attachTo, isPanning, screenToBgLocal, screenToBaseLocal]
  );

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
        xmlns="http://www.w3.org/2000/svg"
        sx={{ width: "100%", height: "100%", display: "block" }}
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
            {/* <g>
              {baseAnnots.map((p, i) => (
                <rect
                  key={i}
                  x={p.x - 6}
                  y={p.y - 6}
                  width={12}
                  height={12}
                  fill="#1976d2"
                />
              ))}
            </g> */}
          </g>
        </g>
      </Box>
    </Box>
  );
}
