import * as htmlToImage from "html-to-image";

import downloadBlob from "Features/files/utils/downloadBlob";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";

import getCaptureRectBounds from "./getCaptureRectBounds";
import {
  CAPTURE_BORDER_INSET,
  CAPTURE_BORDER_RADIUS,
} from "./captureBorderConstants";

// A4 page sizes (pdf-lib points) matched to the capture aspect ratio so the
// cropped image fills the PDF page with minimal margins.
function getPdfPageSize(aspectRatio) {
  switch (aspectRatio) {
    case "PORTRAIT":
      return { pageWidth: 595, pageHeight: 842 };
    case "SQUARE":
      return { pageWidth: 595, pageHeight: 595 };
    case "LANDSCAPE":
    default:
      return { pageWidth: 842, pageHeight: 595 };
  }
}

/**
 * Capture only the area inside the image-mode rectangle as a PNG.
 *
 * Whitelist-based: only elements explicitly marked `data-capture-keep`
 * (and their descendants) are visible during capture. Everything else
 * inside the host is hidden — so any UI added in the future (poppers,
 * toolbars, side panels…) is automatically excluded from the screenshot
 * unless someone deliberately opts in.
 *
 * `data-capture-hide` still works inside keep zones (e.g. the legend's
 * resize handle sits inside the legend group but should not be captured).
 *
 * @param {Object} opts
 * @param {string} opts.viewerKey
 * @param {"clipboard"|"download"|"blob"} opts.target "blob" returns the
 *   cropped PNG Blob instead of downloading/copying it (POV thumbnails).
 * @param {string} [opts.fileName]
 * @param {"LANDSCAPE"|"SQUARE"|"PORTRAIT"} [opts.aspectRatio]
 * @param {number} [opts.pixelRatio]
 * @param {number} [opts.rightInset] width occluded by an open right panel; the
 *   capture rect is centered within the visible zone (must match the overlay).
 * @param {"png"|"pdf"} [opts.format] download format ("pdf" only for download)
 * @param {boolean} [opts.roundedBorderMask] make every pixel outside the
 *   rounded border (imageModeBorder overlay) transparent in the output.
 * @param {(host: HTMLElement, ctx: {pixelRatio: number}) => Promise<() => void>}
 *   [opts.prepareHost] pre-capture step making non-clonable content capturable
 *   (e.g. snapshotting a WebGL canvas into a `data-capture-keep` img — the
 *   html-to-image clone reads canvases asynchronously, after a non
 *   preserveDrawingBuffer WebGL buffer has been cleared). Runs before the
 *   visibility plan so injected nodes are part of it; returns a cleanup fn.
 */
export default async function captureMapAsPng({
  viewerKey = "MAP",
  target = "clipboard",
  fileName = "map.png",
  aspectRatio = "LANDSCAPE",
  pixelRatio = 2,
  whiteBackground = false,
  rightInset = 0,
  format = "png",
  roundedBorderMask = false,
  prepareHost,
} = {}) {
  const host = document.querySelector(
    `[data-image-capture-host="${viewerKey}"]`
  );
  if (!host) {
    console.warn(
      `[captureMapAsPng] no host found for viewerKey=${viewerKey}`
    );
    return;
  }

  const hostBounds = host.getBoundingClientRect();
  const rect = getCaptureRectBounds(
    hostBounds.width,
    hostBounds.height,
    aspectRatio,
    { rightInset }
  );
  if (rect.width <= 0 || rect.height <= 0) return;

  // Pre-capture step (e.g. WebGL snapshot img) BEFORE the visibility plan
  // so the injected nodes are included in it and whitelisted normally.
  const cleanupPrepare = prepareHost
    ? await prepareHost(host, { pixelRatio })
    : null;

  // Build the visibility plan.
  //
  // html-to-image's clone process doesn't reliably cascade inherited
  // `visibility: hidden` from a parent to its descendants, so we set
  // it explicitly on every descendant. Three passes:
  //   1. Hide every descendant of the host.
  //   2. Re-show each `[data-capture-keep]` element AND all its descendants.
  //   3. Re-hide each `[data-capture-hide]` element AND all its descendants
  //      (so e.g. the legend's resize handle, which sits inside a keep zone,
  //      still gets hidden).
  const allDescendants = Array.from(host.querySelectorAll("*"));
  const restoreList = allDescendants.map((el) => [el, el.style.visibility]);

  allDescendants.forEach((el) => {
    el.style.visibility = "hidden";
  });

  host.querySelectorAll("[data-capture-keep]").forEach((keep) => {
    keep.style.visibility = "visible";
    keep.querySelectorAll("*").forEach((child) => {
      child.style.visibility = "visible";
    });
  });

  host.querySelectorAll("[data-capture-hide]").forEach((hide) => {
    hide.style.visibility = "hidden";
    hide.querySelectorAll("*").forEach((child) => {
      child.style.visibility = "hidden";
    });
  });

  try {
    const fullCanvas = await htmlToImage.toCanvas(host, {
      pixelRatio,
      // Optional white background: when enabled, fills the canvas before
      // drawing so the cropped PNG has no transparency (useful for
      // pasting into Word / Slides). Otherwise the unrendered (hidden)
      // areas stay transparent.
      ...(whiteBackground ? { backgroundColor: "#ffffff" } : {}),
    });

    // Crop the canvas to the capture rectangle (in pixel-ratio space).
    const sx = rect.left * pixelRatio;
    const sy = rect.top * pixelRatio;
    const sw = rect.width * pixelRatio;
    const sh = rect.height * pixelRatio;

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext("2d");
    ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    // Rounded-border clipping: keep only the pixels inside the border path
    // (same geometry as the ImageModeOverlay border, scaled by pixelRatio) —
    // the outside becomes transparent, white background included.
    if (roundedBorderMask) {
      const inset = CAPTURE_BORDER_INSET * pixelRatio;
      const radius = CAPTURE_BORDER_RADIUS * pixelRatio;
      ctx.globalCompositeOperation = "destination-in";
      ctx.beginPath();
      roundedRectPath(
        ctx,
        inset,
        inset,
        Math.max(0, sw - 2 * inset),
        Math.max(0, sh - 2 * inset),
        radius
      );
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    const blob = await new Promise((resolve) =>
      out.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    if (target === "blob") {
      return blob;
    }

    if (target === "clipboard") {
      // Clipboard is always PNG.
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        console.warn(
          "[captureMapAsPng] Clipboard API unavailable, falling back to download"
        );
        downloadBlob(blob, fileName);
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } else if (format === "pdf") {
      const url = URL.createObjectURL(blob);
      try {
        const { pageWidth, pageHeight } = getPdfPageSize(aspectRatio);
        const pdfFile = await imageToPdfAsync({ url, pageWidth, pageHeight });
        downloadBlob(pdfFile, fileName);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      downloadBlob(blob, fileName);
    }
  } finally {
    // Restore every descendant's visibility to whatever it was before.
    restoreList.forEach(([el, v]) => {
      el.style.visibility = v;
    });
    cleanupPrepare?.();
  }
}

// ctx.roundRect is not available on every supported browser yet.
function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
