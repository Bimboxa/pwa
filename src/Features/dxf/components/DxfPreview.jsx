import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import { Box, Button, Slider, Typography } from "@mui/material";

import { drawDxf } from "../utils/renderDxf.js";

export default function DxfPreview({ drawing, frame, hiddenLayers }) {
  // state
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);

  // effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // MUI Box consumes width/height as CSS system props. Set the bitmap
    // dimensions on the canvas itself before drawing in frame coordinates.
    // Otherwise its buffer stays at 300 × 150 and clips the drawing.
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (context) drawDxf(context, drawing, frame, hiddenLayers);
  }, [drawing, frame, hiddenLayers]);

  // handlers
  function handlePointerDown(event) {
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const start = dragRef.current;
    if (!start) return;
    viewportRef.current.scrollLeft = start.left - (event.clientX - start.x);
    viewportRef.current.scrollTop = start.top - (event.clientY - start.y);
  }

  // render
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Typography variant="body2">Zoom</Typography>
        <Slider
          aria-label="Zoom de l’aperçu DXF"
          min={50}
          max={400}
          step={25}
          value={zoom}
          onChange={(_, value) => setZoom(value)}
          sx={{ maxWidth: 200 }}
        />
        <Button
          size="small"
          onClick={() => {
            setZoom(100);
            viewportRef.current?.scrollTo(0, 0);
          }}
        >
          Ajuster
        </Button>
      </Box>
      <Box
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        sx={{
          height: 430,
          overflow: "auto",
          bgcolor: "grey.200",
          border: 1,
          borderColor: "divider",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <Box
          component="canvas"
          ref={canvasRef}
          aria-label="Aperçu du DXF selon les calques visibles"
          role="img"
          sx={{
            display: "block",
            width: `${zoom}%`,
            maxWidth: "none",
            height: "auto",
            bgcolor: "white",
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        Glissez pour déplacer l’aperçu. Le cadrage reste fixe lorsque les
        calques sont masqués.
      </Typography>
    </Box>
  );
}

DxfPreview.propTypes = {
  drawing: PropTypes.object.isRequired,
  frame: PropTypes.object.isRequired,
  hiddenLayers: PropTypes.instanceOf(Set).isRequired,
};
