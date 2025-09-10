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
    selectedAnnotationIds,
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
  //const [basePose, setBasePose] = useState({ x: 0, y: 0, k: 1, r: 0 }); // mainBaseMap positioned in world

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

  // Fit-to-view (based on bgImage by default)
  const fit = useCallback(() => {
    // Prefer the visible layer for fitting
    const W = (showBgImage ? bgSize.w : 0) || baseSize.w;
    const H = (showBgImage ? bgSize.h : 0) || baseSize.h;
    console.log("debug_0509 fit", W, H, viewport.wMap, viewport.h);
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

      // Check if we're in marker creation mode
      if (enabledDrawingMode === "MARKER" && onNewAnnotation) {
        onNewAnnotation({
          type: "MARKER",
          x: ratioX,
          y: ratioY,
        });
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
        //ref={ref}
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
          //left: -99999, // keep it offscreen
          left: 0,
          top: 0,
          zIndex: 30,
          pointerEvents: "none",
          zIndex: -1,
          //visibility: "hidden",
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* BG layer in bg-local coords (identity pose) */}
        <g>
          {showBgImage && (
            <NodeSvgImage src={bgImageUrl} width={bgSize.w} height={bgSize.h} />
          )}

          {/* If you ever have annotations attached to BG, render them here */}
          {/* e.g., <NodePolygon .../> / markers-on-bg, etc. */}
        </g>

        {/* BASE layer expressed relative to BG */}
        <g
          transform={`translate(${relBase.x}, ${relBase.y}) scale(${relBase.k})`}
        >
          <NodeSvgImage
            src={baseMapImageUrl}
            width={baseSize.w}
            height={baseSize.h}
          />
          {/* Annotations that you currently render in the base layer */}
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
          {/* {markers?.map((marker) => (
            <NodeMarkerVariantDot
              key={marker.id}
              marker={marker}
              bgSize={bgSize}
              bgPose={{ x: 0, y: 0, k: 1, r: 0 }} // normalized space
              worldScale={1} // no world zoom in export
              onDragEnd={() => {}}
              onClick={() => {}}
            />
          ))}
          {textAnnotations.map((ta) => (
            <NodeText
              key={ta.id + "_"}
              text={ta}
              bgSize={bgSize}
              bgPose={{ x: 0, y: 0, k: 1, r: 0 }}
              worldScale={1}
              onChange={() => {}}
              onDragEnd={() => {}}
              onClick={() => {}}
            />
          ))}
          {polygonAnnotations.map((pa) => (
            <NodePolygon
              key={pa.id + "_"}
              polygon={pa}
              imageSize={baseSize}
              containerK={basePose.k}
              worldScale={1}
              onDragEnd={() => {}}
              onClick={() => {}}
            />
          ))} */}
        </g>
      </svg>
    </Box>
  );
});

export default MapEditorGeneric;
