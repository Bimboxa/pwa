import { useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Popover,
  Tooltip,
} from "@mui/material";
import { AutoFixHigh as MagicIcon } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import detectSimilarStrips from "Features/smartDetect/utils/detectSimilarStrips";
import editor from "App/editor";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function loadImageData(imageUrl, imageSize) {
  if (!imageUrl || !imageSize?.width || !imageSize?.height) return null;
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = imageSize.width;
  canvas.height = imageSize.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, imageSize.width, imageSize.height);
  return ctx.getImageData(0, 0, imageSize.width, imageSize.height);
}

function computeStripWidthInImagePx(annotation, baseMapMeterByPx, imageScale) {
  const { strokeWidth = 20, strokeWidthUnit = "PX" } = annotation;
  if (strokeWidthUnit === "CM" && baseMapMeterByPx > 0) {
    return Math.abs((strokeWidth * 0.01) / baseMapMeterByPx / imageScale);
  }
  return Math.abs(strokeWidth / imageScale);
}

function buildExclusionMask(annotations, imageSize, imageScale, imageOffset, meterByPx, sourceAnnotationId) {
  const { width, height } = imageSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 2) continue;
    if (ann.id === sourceAnnotationId) continue;

    const toImgPx = (p) => ({
      x: (p.x - imageOffset.x) / imageScale,
      y: (p.y - imageOffset.y) / imageScale,
    });

    if (ann.type === "STRIP") {
      const polys = getStripePolygons(ann, meterByPx);
      for (const poly of polys) {
        if (!poly.points || poly.points.length < 3) continue;
        ctx.beginPath();
        const pts = poly.points.map(toImgPx);
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fill();
      }
    } else if (ann.type === "POLYGON" || (ann.type === "POLYLINE" && ann.closeLine)) {
      const pts = ann.points.map(toImgPx);
      if (pts.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    } else if (ann.type === "POLYLINE") {
      const pts = ann.points.map(toImgPx);
      if (pts.length < 2) continue;
      const sw = ann.strokeWidth ?? 1;
      const swPx = ann.strokeWidthUnit === "CM" && meterByPx > 0
        ? Math.abs((sw * 0.01) / meterByPx / imageScale)
        : Math.abs(sw / imageScale);
      ctx.lineWidth = swPx;
      ctx.strokeStyle = "white";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }

  const data = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (data[i * 4] > 0) mask[i] = 1;
  }
  return mask;
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export default function IconButtonDetectSimilarStrips({
  annotation,
  accentColor,
}) {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const annotations = useAnnotationsV2({ caller: "IconButtonDetectSimilarStrips" });

  // state

  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [optColinear, setOptColinear] = useState(true);
  const [optTransverse, setOptTransverse] = useState(true);
  const [optSquares, setOptSquares] = useState(true);

  // helpers

  const open = Boolean(anchorEl);

  // handlers

  function handleIconClick(event) {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleDetect() {
    handleClose();
    if (loading) return;

    const imageUrl = baseMap?.getUrl();
    const imageSize = baseMap?.getImageSize();
    const meterByPx = baseMap?.getMeterByPx() ?? 0;
    const imageScale = baseMap?.getImageScale() ?? 1;
    const imageOffset = baseMap?.getImageOffset() ?? { x: 0, y: 0 };

    if (!imageUrl || !imageSize || !annotation?.points?.length) {
      dispatch(setToaster({ message: "No base map available", isError: true }));
      return;
    }

    const viewportBounds = editor.viewportInBase?.bounds;
    if (!viewportBounds) {
      dispatch(setToaster({ message: "Viewport not available", isError: true }));
      return;
    }

    const viewportBBox = {
      x: Math.max(0, Math.round((viewportBounds.x - imageOffset.x) / imageScale)),
      y: Math.max(0, Math.round((viewportBounds.y - imageOffset.y) / imageScale)),
      width: Math.min(imageSize.width, Math.max(1, Math.round(viewportBounds.width / imageScale))),
      height: Math.min(imageSize.height, Math.max(1, Math.round(viewportBounds.height / imageScale))),
    };

    const stripWidthPx = computeStripWidthInImagePx(annotation, meterByPx, imageScale);
    if (stripWidthPx < 1) {
      dispatch(setToaster({ message: "Strip width too small", isError: true }));
      return;
    }

    setLoading(true);

    try {
      const imageData = await loadImageData(imageUrl, imageSize);
      if (!imageData) {
        dispatch(setToaster({ message: "Cannot load base map image", isError: true }));
        return;
      }

      const centerlineImgPx = annotation.points.map((p) => ({
        x: (p.x - imageOffset.x) / imageScale,
        y: (p.y - imageOffset.y) / imageScale,
      }));

      const exclusionMask = buildExclusionMask(
        annotations || [], imageSize, imageScale, imageOffset, meterByPx, annotation.id
      );

      const results = detectSimilarStrips({
        imageData,
        centerlinePoints: centerlineImgPx,
        stripWidthPx,
        viewportBBox,
        stripOrientation: annotation.stripOrientation ?? 1,
        exclusionMask,
        detectColinear: optColinear,
        detectTransverse: optTransverse,
        detectSquares: optSquares,
      });

      if (results.length === 0) {
        dispatch(setToaster({ message: "No similar strips detected", isError: true }));
        return;
      }

      const toLocal = (p) => ({
        x: p.x * imageScale + imageOffset.x,
        y: p.y * imageScale + imageOffset.y,
      });

      const strips = [];
      for (const result of results) {
        if (!result.segments?.length) continue;
        for (const seg of result.segments) {
          const localCenterline = [toLocal(seg.start), toLocal(seg.end)];
          const fakeAnnotation = { ...annotation, points: localCenterline };
          const polys = getStripePolygons(fakeAnnotation, meterByPx);
          const polygon = polys?.[0]?.points || [];
          strips.push({ centerline: localCenterline, polygon });
        }
      }

      if (strips.length === 0) {
        dispatch(setToaster({ message: "No similar strips detected", isError: true }));
        return;
      }

      window.dispatchEvent(
        new CustomEvent("detectedSimilarStrips", {
          detail: { strips, sourceAnnotation: annotation },
        })
      );

      dispatch(
        setToaster({
          message: `${strips.length} strip${strips.length > 1 ? "s" : ""} detected — press [Space] to validate`,
        })
      );
    } catch (err) {
      console.error("[detectSimilarStrips] error:", err);
      dispatch(setToaster({ message: "Detection error", isError: true }));
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <>
      <Tooltip title="Détection similaire">
        <IconButton
          size="small"
          onClick={handleIconClick}
          disabled={loading}
          sx={{
            color: open ? accentColor : "text.disabled",
            bgcolor: open ? accentColor + "18" : "transparent",
            ...(accentColor && {
              "&:hover": {
                color: accentColor,
                bgcolor: accentColor + "18",
              },
            }),
          }}
        >
          {loading ? (
            <CircularProgress size={18} thickness={5} />
          ) : (
            <MagicIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5 } } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", px: 1.5, py: 1, minWidth: 180 }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={optColinear} onChange={(e) => setOptColinear(e.target.checked)} />}
            label="Colinéaire"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={optTransverse} onChange={(e) => setOptTransverse(e.target.checked)} />}
            label="Transverse"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={optSquares} onChange={(e) => setOptSquares(e.target.checked)} />}
            label="Extension carrés"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <Button
            size="small"
            variant="contained"
            onClick={handleDetect}
            sx={{ mt: 0.5, textTransform: "none" }}
          >
            Détecter
          </Button>
        </Box>
      </Popover>
    </>
  );
}
