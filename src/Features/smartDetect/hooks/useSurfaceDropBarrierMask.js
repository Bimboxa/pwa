import { useEffect, useRef, useState } from "react";

import buildExclusionMask from "Features/smartDetect/utils/buildExclusionMask";

async function loadLuminanceMask(imageUrl, imageSize, darknessThreshold) {
  if (!imageUrl || !imageSize?.width || !imageSize?.height) return null;
  const { width, height } = imageSize;
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const base = i * 4;
    const lum = (data[base] + data[base + 1] + data[base + 2]) / 3;
    if (lum < darknessThreshold) mask[i] = 1;
  }
  return { mask, width, height };
}

/**
 * Builds the two full-image barrier masks used by the SURFACE_DROP
 * smartDetect mode (loupe flood-fill):
 *
 *   luminanceMask   — dark pixels of the base map (cached on
 *                     baseMapImageUrl + darknessThreshold).
 *   annotationsMask — rasterized visible annotation barriers, rebuilt
 *                     whenever the annotation set changes.
 *
 * Both masks are Uint8Array(width × height) full-image arrays so the
 * BFS flood-fill can OR them in O(1) per pixel.
 *
 * Both rebuilds are **deferred via setTimeout(0)** — same pattern as
 * strip detection's cache-building effect in InteractionLayer.jsx.
 * This matters after a SURFACE_DROP commit: the new annotation changes
 * the `annotations` array synchronously, and a useMemo-based mask
 * rebuild would block the render between DB write and paint, making
 * the commit feel laggy. Deferring yields to paint first, then
 * rebuilds the mask in the background for the next mouse move.
 *
 * The hook is idle until `enabled` is true — mounting the editor does
 * not pay the cost of decoding the base-map image until the user
 * actually picks SURFACE_DROP + smartDetect.
 */
export default function useSurfaceDropBarrierMask({
  enabled,
  baseMapImageUrl,
  imageSize,
  imageScale,
  imageOffset,
  meterByPx,
  annotations,
  darknessThreshold = 100,
}) {
  const [luminance, setLuminance] = useState(null);
  const [annotationsMask, setAnnotationsMask] = useState(null);
  const currentLoadKeyRef = useRef(null);

  // Load / cache the luminance mask asynchronously, keyed on the image
  // URL + threshold. A key change cancels the previous load.
  useEffect(() => {
    if (!enabled) return;
    if (!baseMapImageUrl || !imageSize?.width || !imageSize?.height) return;
    const key = `${baseMapImageUrl}::${darknessThreshold}`;
    if (luminance?.key === key) return;

    currentLoadKeyRef.current = key;
    let cancelled = false;
    loadLuminanceMask(baseMapImageUrl, imageSize, darknessThreshold)
      .then((res) => {
        if (cancelled) return;
        if (currentLoadKeyRef.current !== key) return;
        if (!res) return;
        setLuminance({ key, ...res });
      })
      .catch((err) => {
        console.warn("[useSurfaceDropBarrierMask] luminance load failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    baseMapImageUrl,
    imageSize?.width,
    imageSize?.height,
    darknessThreshold,
    luminance?.key,
  ]);

  // Annotations mask — rebuilt asynchronously whenever the annotation
  // set changes. Deferred with setTimeout(0) so the render following
  // a SURFACE_DROP commit isn't blocked by the full-image rasterize.
  useEffect(() => {
    if (!enabled) return;
    if (!imageSize?.width || !imageSize?.height) return;

    let cancelled = false;
    const handle = setTimeout(() => {
      if (cancelled) return;
      try {
        const mask =
          !annotations || annotations.length === 0
            ? new Uint8Array(imageSize.width * imageSize.height)
            : buildExclusionMask(
                annotations,
                imageSize,
                imageScale,
                imageOffset,
                meterByPx
              );
        if (!cancelled) setAnnotationsMask(mask);
      } catch (err) {
        console.warn(
          "[useSurfaceDropBarrierMask] annotations mask failed:",
          err
        );
        if (!cancelled) {
          setAnnotationsMask(
            new Uint8Array(imageSize.width * imageSize.height)
          );
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    enabled,
    annotations,
    imageSize?.width,
    imageSize?.height,
    imageScale,
    imageOffset?.x,
    imageOffset?.y,
    meterByPx,
  ]);

  if (!enabled) return null;
  if (!luminance) return null;

  return {
    luminanceMask: luminance.mask,
    annotationsMask,
    width: luminance.width,
    height: luminance.height,
  };
}
