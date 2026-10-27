/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import {
  getPreviewTransform,
  previewToImage,
  zoomPreviewAt,
  getSliceAlignmentYaw,
} from "../utils/slicePreviewGeometry";

const INITIAL_VIEWPORT = { zoom: 1, x: 0, y: 0 };

export default function LocalScanSlicePreview({
  result,
  mode,
  pending,
  onRotate,
}) {
  // state
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 280 });
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const [selectAxis, setSelectAxis] = useState(false);
  const [firstPoint, setFirstPoint] = useState(null);
  const [message, setMessage] = useState(null);
  const canPick = Boolean(result?.pointCount) && !pending;

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
    setMessage(null);
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
    context.globalAlpha = pending ? 0.5 : 1;
    context.drawImage(
      imageRef.current,
      transform.x,
      transform.y,
      result.width * transform.scale,
      result.height * transform.scale
    );
    context.globalAlpha = 1;
    if (firstPoint) {
      const x = transform.x + firstPoint.x * transform.scale;
      const y = transform.y + firstPoint.y * transform.scale;
      context.strokeStyle = "#ff610d";
      context.fillStyle = "#ff610d";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 6, 0, Math.PI * 2);
      context.stroke();
      context.font = "bold 14px sans-serif";
      context.fillText("1", x + 10, y - 8);
    }
  }, [result, mode, pending, size, viewport, firstPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wheel = (event) => {
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
  }, [size]);

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
    setMessage(null);
  }
  function pointerDown(event) {
    if (event.button !== 0 || dragRef.current) return;
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
    cancelAxis();
    onRotate(angle);
  }

  // render
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
        <Button
          size="small"
          aria-label="Dézoomer l’image"
          onClick={() => zoom(1 / 1.5)}
        >
          −
        </Button>
        <Button
          size="small"
          aria-label="Zoomer l’image"
          onClick={() => zoom(1.5)}
        >
          +
        </Button>
        <Button size="small" onClick={() => setViewport(INITIAL_VIEWPORT)}>
          Cadrer l’image
        </Button>
        <Typography variant="caption" sx={{ alignSelf: "center" }}>
          {Math.round(viewport.zoom * 100)} %
        </Typography>
      </Stack>
      <Button
        size="small"
        variant={selectAxis ? "contained" : "outlined"}
        disabled={!canPick && !selectAxis}
        onClick={() => {
          if (selectAxis) cancelAxis();
          else {
            setSelectAxis(true);
            setMessage(null);
          }
        }}
      >
        {selectAxis ? "Annuler l’axe" : "Définir l’axe horizontal (2 points)"}
      </Button>
      <Typography variant="caption" aria-live="polite">
        {message ||
          (selectAxis
            ? firstPoint
              ? "Cliquez le second point : la direction 1 → 2 deviendra horizontale vers la droite."
              : "Cliquez le premier point de l’axe dans l’image."
            : "Molette : zoom · Glisser : déplacer. L’axe choisi fait pivoter le scan en 3D autour de son origine.")}
      </Typography>
      <Box
        sx={{
          position: "relative",
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
          tabIndex={0}
          aria-label="Image de la coupe horizontale"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
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
            display: "block",
            width: "100%",
            height: 280,
            touchAction: "none",
            cursor: selectAxis ? "crosshair" : "grab",
          }}
        />
        {pending && (
          <LinearProgress
            sx={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
          />
        )}
      </Box>
    </Stack>
  );
}
