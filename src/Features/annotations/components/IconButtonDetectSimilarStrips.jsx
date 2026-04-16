import { useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import { AutoFixHigh as MagicIcon } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import detectSimilarStrips, { computeNormal } from "Features/smartDetect/utils/detectSimilarStrips";
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
    // CM → meters → local px → image px
    return Math.abs((strokeWidth * 0.01) / baseMapMeterByPx / imageScale);
  }
  // strokeWidth is in local-coord px, convert to image px
  return Math.abs(strokeWidth / imageScale);
}

/**
 * Rasterize visible annotations into a Uint8Array exclusion mask
 * (1 = pixel covered by an existing annotation).
 */
function buildExclusionMask(annotations, imageSize, imageScale, imageOffset, meterByPx, sourceAnnotationId) {
  const { width, height } = imageSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 2) continue;
    if (ann.id === sourceAnnotationId) continue; // skip the source strip itself

    // Convert annotation points (local coords) to image-pixel coords
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
      // Open polyline: draw with strokeWidth
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

  // Read back as exclusion mask
  const data = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    // Any non-black pixel = excluded (we drew white on black canvas)
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

  // handlers

  const handleClick = async () => {
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

    // Viewport bounds in local coords → image pixel coords
    const viewportBounds = editor.viewportInBase?.bounds;
    if (!viewportBounds) {
      dispatch(
        setToaster({ message: "Viewport not available", isError: true })
      );
      return;
    }

    const viewportBBox = {
      x: Math.max(0, Math.round((viewportBounds.x - imageOffset.x) / imageScale)),
      y: Math.max(0, Math.round((viewportBounds.y - imageOffset.y) / imageScale)),
      width: Math.min(
        imageSize.width,
        Math.max(1, Math.round(viewportBounds.width / imageScale))
      ),
      height: Math.min(
        imageSize.height,
        Math.max(1, Math.round(viewportBounds.height / imageScale))
      ),
    };

    // Strip polygon and width in image px
    const polygons = getStripePolygons(annotation, meterByPx);
    if (!polygons?.length || !polygons[0].points?.length) {
      dispatch(
        setToaster({ message: "Cannot compute strip geometry", isError: true })
      );
      return;
    }

    const stripWidthPx = computeStripWidthInImagePx(annotation, meterByPx, imageScale);
    if (stripWidthPx < 1) {
      dispatch(
        setToaster({ message: "Strip width too small", isError: true })
      );
      return;
    }

    setLoading(true);

    try {
      const imageData = await loadImageData(imageUrl, imageSize);
      if (!imageData) {
        dispatch(
          setToaster({ message: "Cannot load base map image", isError: true })
        );
        return;
      }

      // annotation.points are in local coords (resolved).
      // Convert to image-pixel coords for the detection algorithm.
      const centerlineImgPx = annotation.points.map((p) => ({
        x: (p.x - imageOffset.x) / imageScale,
        y: (p.y - imageOffset.y) / imageScale,
      }));

      // Build exclusion mask from visible annotations
      const exclusionMask = buildExclusionMask(
        annotations || [],
        imageSize,
        imageScale,
        imageOffset,
        meterByPx,
        annotation.id
      );

      const results = detectSimilarStrips({
        imageData,
        centerlinePoints: centerlineImgPx,
        stripWidthPx,
        viewportBBox,
        stripOrientation: annotation.stripOrientation ?? 1,
        exclusionMask,
      });

      if (results.length === 0) {
        dispatch(
          setToaster({ message: "No similar strips detected", isError: true })
        );
        return;
      }

      // Normal in image-pixel space
      const normal = computeNormal(centerlineImgPx);

      // Build detected strips with translated centerlines + polygons
      const strips = results.map(({ offset }) => {
        // Translate centerline in image-pixel coords
        const translatedImgPx = centerlineImgPx.map((p) => ({
          x: p.x + offset * normal.dx,
          y: p.y + offset * normal.dy,
        }));

        // Convert back to local coords (for saving & display)
        const localCenterline = translatedImgPx.map((p) => ({
          x: p.x * imageScale + imageOffset.x,
          y: p.y * imageScale + imageOffset.y,
        }));

        // Compute polygon for display (getStripePolygons works in local coords)
        const fakeAnnotation = {
          ...annotation,
          points: localCenterline,
        };
        const polys = getStripePolygons(fakeAnnotation, meterByPx);
        const polygon = polys?.[0]?.points || [];

        return { centerline: localCenterline, polygon };
      });

      // Dispatch to InteractionLayer via custom event
      window.dispatchEvent(
        new CustomEvent("detectedSimilarStrips", {
          detail: { strips, sourceAnnotation: annotation },
        })
      );

      dispatch(
        setToaster({
          message: `${strips.length} similar strip${strips.length > 1 ? "s" : ""} detected — press [Space] to validate`,
        })
      );
    } catch (err) {
      console.error("[detectSimilarStrips] error:", err);
      dispatch(
        setToaster({ message: "Detection error", isError: true })
      );
    } finally {
      setLoading(false);
    }
  };

  // render

  return (
    <Tooltip title="Détection similaire">
      <IconButton
        size="small"
        onClick={handleClick}
        disabled={loading}
        sx={{
          color: "text.disabled",
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
  );
}

