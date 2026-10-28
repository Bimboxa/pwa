/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { darken, lighten, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { ZoomOut } from "@mui/icons-material";
import {
  getPreviewTransform,
  previewToImage,
  zoomPreviewAt,
  getSliceAlignmentYaw,
} from "../utils/slicePreviewGeometry";

const INITIAL_VIEWPORT = { zoom: 1, x: 0, y: 0 };

// 256-entry colour ramp of the height heat map: light to dark variants of
// the secondary colour (low to high). → [r, g, b][]
function buildHeatRamp(secondary) {
  const parse = (css) => {
    const match = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
    return match ? match.slice(1, 4).map(Number) : [0, 0, 0];
  };
  const low = parse(lighten(secondary, 0.85));
  const mid = parse(secondary);
  const high = parse(darken(secondary, 0.45));
  return Array.from({ length: 256 }, (_, i) => {
    const t = i / 255;
    const [a, b, k] = t < 0.5 ? [low, mid, t * 2] : [mid, high, (t - 0.5) * 2];
    return a.map((value, c) => Math.round(value + (b[c] - value) * k));
  });
}

// Heat map raster (RGBA canvas) of a height preview, empty pixels left
// transparent. The ramp runs over the slice: light at Z inf and below (the
// floor), dark at Z sup and above — not over the extreme heights, which a
// few stray points would stretch.
function buildHeatCanvas(preview, ramp, lower, upper) {
  const { width, height, heights } = preview;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const min = lower;
  const span = upper - lower || 1;
  for (let i = 0; i < heights.length; i++) {
    const value = heights[i];
    if (Number.isNaN(value)) continue;
    const [r, g, b] =
      ramp[
        Math.max(0, Math.min(255, Math.round(((value - min) / span) * 255)))
      ];
    pixels[i * 4] = r;
    pixels[i * 4 + 1] = g;
    pixels[i * 4 + 2] = b;
    pixels[i * 4 + 3] = 215;
  }
  canvas
    .getContext("2d")
    .putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

export default function LocalScanSlicePreview({
  result,
  mode,
  pending,
  stale = false,
  onRotate,
  overlayControls,
  // Controls laid over the left edge of the image (the slice slider).
  sideControls,
  aspectRatio = 297 / 210,
  onFramingChange,
  // Height preview (projectLocalScanHeightPreview result) drawn as a heat
  // map over the image, same raster.
  heightPreview = null,
}) {
  // data
  const theme = useTheme();
  const secondary = theme.palette.secondary.main;

  // state
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const heatRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 280 });
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const [selectAxis, setSelectAxis] = useState(false);
  const [firstPoint, setFirstPoint] = useState(null);
  const [confirmedAxis, setConfirmedAxis] = useState(null);
  const [pointerPosition, setPointerPosition] = useState(null);
  const [message, setMessage] = useState(null);
  const canPick = Boolean(result?.pointCount) && !pending && !stale;

  // helpers
  useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      setSize({
        width: canvas.clientWidth || 1,
        height: canvas.clientHeight || 280,
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setFirstPoint(null);
    setPointerPosition(null);
    setMessage(null);
  }, [result, pending, stale]);

  useEffect(() => {
    setConfirmedAxis(null);
  }, [result, pending]);

  useEffect(() => {
    if (!result) {
      imageRef.current = null;
      return;
    }
    const image = document.createElement("canvas");
    image.width = result.width;
    image.height = result.height;
    image
      .getContext("2d")
      .putImageData(
        new ImageData(result[mode], result.width, result.height),
        0,
        0
      );
    imageRef.current = image;
  }, [result, mode]);

  useEffect(() => {
    if (
      !heightPreview ||
      !result ||
      heightPreview.width !== result.width ||
      heightPreview.height !== result.height
    ) {
      heatRef.current = null;
      return;
    }
    heatRef.current = buildHeatCanvas(
      heightPreview,
      buildHeatRamp(secondary),
      result.lower,
      result.upper
    );
  }, [heightPreview, result, secondary]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(size.width * dpr),
      height = Math.round(size.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    if (!result || !imageRef.current) return;
    const transform = getPreviewTransform(size, result, viewport);
    context.imageSmoothingEnabled = false;
    context.globalAlpha = pending || stale ? 0.5 : 1;
    context.drawImage(
      imageRef.current,
      transform.x,
      transform.y,
      result.width * transform.scale,
      result.height * transform.scale
    );
    if (heatRef.current)
      context.drawImage(
        heatRef.current,
        transform.x,
        transform.y,
        result.width * transform.scale,
        result.height * transform.scale
      );
    context.globalAlpha = 1;
    const start = confirmedAxis?.first ?? firstPoint;
    const endpoint = confirmedAxis
      ? {
          x: transform.x + confirmedAxis.second.x * transform.scale,
          y: transform.y + confirmedAxis.second.y * transform.scale,
        }
      : pointerPosition;
    if (start) {
      const x = transform.x + start.x * transform.scale;
      const y = transform.y + start.y * transform.scale;
      if ((confirmedAxis || (selectAxis && canPick)) && endpoint) {
        const candidate = previewToImage(endpoint, transform);
        const dx = endpoint.x - x;
        const dy = endpoint.y - y;
        if (
          candidate.x >= 0 &&
          candidate.x < result.width &&
          candidate.y >= 0 &&
          candidate.y < result.height &&
          Math.hypot(dx, dy) > 8
        ) {
          const angle = Math.atan2(dy, dx);
          context.save();
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(endpoint.x, endpoint.y);
          // A white underlay keeps the axis legible on both rasters.
          context.strokeStyle = "white";
          context.lineWidth = 4;
          context.stroke();
          context.setLineDash(confirmedAxis ? [] : [7, 4]);
          context.strokeStyle = "#ff610d";
          context.lineWidth = 2;
          context.stroke();
          context.setLineDash([]);
          context.beginPath();
          context.moveTo(endpoint.x, endpoint.y);
          context.lineTo(
            endpoint.x - 11 * Math.cos(angle - Math.PI / 6),
            endpoint.y - 11 * Math.sin(angle - Math.PI / 6)
          );
          context.lineTo(
            endpoint.x - 11 * Math.cos(angle + Math.PI / 6),
            endpoint.y - 11 * Math.sin(angle + Math.PI / 6)
          );
          context.closePath();
          context.fillStyle = "#ff610d";
          context.fill();
          context.font = "bold 14px sans-serif";
          context.fillText("2", endpoint.x + 10, endpoint.y - 8);
          context.restore();
        }
      }
      context.strokeStyle = "#ff610d";
      context.fillStyle = "#ff610d";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 6, 0, Math.PI * 2);
      context.stroke();
      context.font = "bold 14px sans-serif";
      context.fillText("1", x + 10, y - 8);
    }
  }, [
    result,
    mode,
    pending,
    stale,
    heightPreview,
    secondary,
    size,
    viewport,
    firstPoint,
    confirmedAxis,
    pointerPosition,
    selectAxis,
    canPick,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wheel = (event) => {
      if (!result) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = Math.exp(
        -Math.max(-200, Math.min(200, event.deltaY)) * 0.002
      );
      setViewport((previous) =>
        zoomPreviewAt(
          previous,
          factor,
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          size
        )
      );
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [size, result]);

  // Framed image rectangle (canvas corners in image px) for the base map.
  useEffect(() => {
    if (!onFramingChange) return;
    if (!result) return onFramingChange(null);
    const transform = getPreviewTransform(size, result, viewport);
    const topLeft = previewToImage({ x: 0, y: 0 }, transform);
    const bottomRight = previewToImage(
      { x: size.width, y: size.height },
      transform
    );
    onFramingChange({
      result,
      rect: {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      },
    });
  }, [onFramingChange, result, size, viewport]);

  // handlers
  function zoom(factor) {
    setViewport((previous) =>
      zoomPreviewAt(
        previous,
        factor,
        { x: size.width / 2, y: size.height / 2 },
        size
      )
    );
  }
  function cancelAxis() {
    setSelectAxis(false);
    setFirstPoint(null);
    setPointerPosition(null);
    setMessage(null);
  }
  function pointerDown(event) {
    if (!result || event.button !== 0 || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      viewport,
      moved: false,
    };
  }
  function pointerMove(event) {
    if (selectAxis && firstPoint && canPick) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPointerPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved)
      setViewport({
        ...drag.viewport,
        x: drag.viewport.x + dx,
        y: drag.viewport.y + dy,
      });
  }
  function pointerUp(event) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved || !selectAxis || !canPick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = previewToImage(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      getPreviewTransform(size, result, viewport)
    );
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= result.width ||
      point.y >= result.height
    ) {
      setMessage("Choisissez un point à l’intérieur de l’image.");
      return;
    }
    if (!firstPoint) {
      setFirstPoint(point);
      setPointerPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      setMessage(null);
      return;
    }
    const angle = getSliceAlignmentYaw(firstPoint, point);
    if (angle === null) {
      setMessage(
        "Les deux points sont trop proches. Choisissez un point plus éloigné."
      );
      return;
    }
    setConfirmedAxis({ first: firstPoint, second: point });
    cancelAxis();
    onRotate(angle);
  }

  // render
  return (
    <Stack spacing={0.5}>
      {onRotate && (
        <Button
          size="small"
          variant={selectAxis ? "contained" : "outlined"}
          disabled={!canPick && !selectAxis}
          onClick={() => {
            if (selectAxis) cancelAxis();
            else {
              setConfirmedAxis(null);
              setSelectAxis(true);
              setMessage(null);
            }
          }}
        >
          {selectAxis ? "Annuler l’axe" : "Définir l’axe horizontal (2 points)"}
        </Button>
      )}
      {result && (
        <Typography variant="caption" aria-live="polite">
          {message ||
            (selectAxis
              ? firstPoint
                ? "Cliquez le second point : la direction 1 → 2 deviendra horizontale vers la droite."
                : "Cliquez le premier point de l’axe dans l’image."
              : onRotate
                ? "Molette : zoom · Glisser : déplacer. L’axe choisi fait pivoter le scan en 3D autour de son origine."
                : "Molette : zoom · Glisser : déplacer.")}
        </Typography>
      )}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio,
          border: 1,
          borderColor: "divider",
          bgcolor: "white",
          overflow: "hidden",
        }}
      >
        <Box
          component="canvas"
          ref={canvasRef}
          role="img"
          tabIndex={result ? 0 : -1}
          aria-label="Image de la coupe horizontale"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={() => setPointerPosition(null)}
          onPointerCancel={() => {
            dragRef.current = null;
            setPointerPosition(null);
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelAxis();
            if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoom(1.5);
            }
            if (event.key === "-") {
              event.preventDefault();
              zoom(1 / 1.5);
            }
            if (event.key === "Home") {
              event.preventDefault();
              setViewport(INITIAL_VIEWPORT);
            }
          }}
          sx={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            touchAction: "none",
            cursor: !result ? "default" : selectAxis ? "crosshair" : "grab",
          }}
        />
        {!result && (
          <Stack
            spacing={1}
            sx={{
              position: "absolute",
              inset: 0,
              p: 3,
              pt: 6,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Choisissez la tranche, puis cliquez sur Calculer.
            </Typography>
            {pending && (
              <Typography variant="caption">
                Calcul de la projection…
              </Typography>
            )}
          </Stack>
        )}
        {sideControls}
        {overlayControls && (
          <Box
            sx={{ position: "absolute", top: 6, left: sideControls ? 56 : 6 }}
          >
            {overlayControls}
          </Box>
        )}
        <Tooltip title="Recadrer l’image">
          <Box component="span" sx={{ position: "absolute", top: 6, right: 6 }}>
            <IconButton
              size="small"
              aria-label="Recadrer l’image"
              disabled={!result}
              onClick={() => setViewport(INITIAL_VIEWPORT)}
              sx={{
                bgcolor: "background.paper",
                boxShadow: 1,
                "&:hover": { bgcolor: "background.default" },
              }}
            >
              <ZoomOut fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
        {pending && (
          <LinearProgress
            sx={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
          />
        )}
      </Box>
    </Stack>
  );
}
