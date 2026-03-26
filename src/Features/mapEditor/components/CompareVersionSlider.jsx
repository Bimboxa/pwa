import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

import { Box, Typography } from "@mui/material";
import { UnfoldMore } from "@mui/icons-material";

const CLIP_RECT_ID = "version-compare-clip-rect";

const CompareVersionSlider = forwardRef(function CompareVersionSlider(
  {
    getCameraMatrix,
    basePose,
    containerBounds,
    activeVersionLabel,
    comparedVersionLabel,
  },
  ref
) {
  // refs

  const containerRef = useRef(null);
  const lineRef = useRef(null);
  const handleRef = useRef(null);
  const sliderPctRef = useRef(50);

  // store props in ref for imperative access
  const propsRef = useRef({ getCameraMatrix, basePose, containerBounds });
  propsRef.current = { getCameraMatrix, basePose, containerBounds };

  // --- imperative core ---

  function updateSliderVisual(pct) {
    if (lineRef.current) lineRef.current.style.left = `${pct}%`;
    if (handleRef.current) handleRef.current.style.left = `${pct}%`;
  }

  function updateClipRect() {
    const clipRect = document.getElementById(CLIP_RECT_ID);
    if (!clipRect) return;

    const { getCameraMatrix: getCamera, basePose: bp, containerBounds: bounds } = propsRef.current;
    if (!getCamera || !bounds?.width) return;

    const cam = getCamera();
    if (!cam) return;

    const bpX = bp?.x ?? 0;
    const bpY = bp?.y ?? 0;
    const bpK = bp?.k ?? 1;
    const screenSliderX = (sliderPctRef.current / 100) * bounds.width;

    // screen → world → basePose local
    const lx0 = ((0 - cam.x) / cam.k - bpX) / bpK;
    const ly0 = ((0 - cam.y) / cam.k - bpY) / bpK;
    const lxS = ((screenSliderX - cam.x) / cam.k - bpX) / bpK;
    const ly1 = ((bounds.height - cam.y) / cam.k - bpY) / bpK;

    clipRect.setAttribute("x", lx0);
    clipRect.setAttribute("y", ly0);
    clipRect.setAttribute("width", lxS - lx0);
    clipRect.setAttribute("height", ly1 - ly0);
  }

  // expose to parent for camera change callbacks
  useImperativeHandle(ref, () => ({ updateClipRect }), []);

  // init
  useEffect(() => {
    updateSliderVisual(sliderPctRef.current);
    requestAnimationFrame(() => updateClipRect());
  }, []);

  // react to prop changes
  useEffect(() => {
    updateClipRect();
  }, [basePose?.x, basePose?.y, basePose?.k, containerBounds?.width, containerBounds?.height]);

  // --- drag ---

  function handleMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();

    function onMove(event) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      let x = clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const pct = (x / rect.width) * 100;
      sliderPctRef.current = pct;
      updateSliderVisual(pct);
      updateClipRect();
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
  }

  // render

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        userSelect: "none",
      }}
    >
      {/* Vertical line */}
      <Box
        ref={lineRef}
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: "2px",
          bgcolor: "secondary.main",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 11,
        }}
      />

      {/* Drag handle */}
      <Box
        ref={handleRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 36,
          height: 36,
          bgcolor: "white",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          color: "grey.700",
          cursor: "col-resize",
          pointerEvents: "auto",
          zIndex: 12,
          "&:hover": { bgcolor: "grey.100" },
        }}
      >
        <UnfoldMore fontSize="small" sx={{ transform: "rotate(90deg)" }} />
      </Box>

      {/* Labels */}
      {activeVersionLabel && (
        <Typography
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            color: "white",
            bgcolor: "rgba(0,0,0,0.5)",
            px: 1,
            borderRadius: 1,
            fontSize: "0.75rem",
            pointerEvents: "none",
          }}
        >
          {activeVersionLabel}
        </Typography>
      )}
      {comparedVersionLabel && (
        <Typography
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            color: "white",
            bgcolor: "rgba(0,0,0,0.5)",
            px: 1,
            borderRadius: 1,
            fontSize: "0.75rem",
            pointerEvents: "none",
          }}
        >
          {comparedVersionLabel}
        </Typography>
      )}
    </Box>
  );
});

export default CompareVersionSlider;
