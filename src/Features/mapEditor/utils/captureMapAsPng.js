import * as htmlToImage from "html-to-image";

import downloadBlob from "Features/files/utils/downloadBlob";

import getCaptureRectBounds from "./getCaptureRectBounds";

/**
 * Capture only the area inside the image-mode rectangle as a PNG.
 *
 * The whole host (`[data-image-capture-host="{viewerKey}"]`) is rendered to
 * a canvas via html-to-image, then cropped to the rectangle bounds. Elements
 * marked `[data-capture-hide]` (toolbar, dim mask, resize handle, etc.) are
 * temporarily hidden so the export is clean.
 *
 * @param {Object} opts
 * @param {string} opts.viewerKey
 * @param {"clipboard"|"download"} opts.target
 * @param {string} [opts.fileName]
 * @param {"LANDSCAPE"|"SQUARE"|"PORTRAIT"} [opts.aspectRatio]
 * @param {number} [opts.pixelRatio]
 */
export default async function captureMapAsPng({
  viewerKey = "MAP",
  target = "clipboard",
  fileName = "map.png",
  aspectRatio = "LANDSCAPE",
  pixelRatio = 2,
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
    aspectRatio
  );
  if (rect.width <= 0 || rect.height <= 0) return;

  // Temporarily hide editing chrome (toolbars, dim mask, handles, etc.)
  const hidden = host.querySelectorAll("[data-capture-hide]");
  const restore = [];
  hidden.forEach((el) => {
    restore.push([el, el.style.visibility]);
    el.style.visibility = "hidden";
  });

  try {
    const fullCanvas = await htmlToImage.toCanvas(host, {
      pixelRatio,
      // bgcolor avoids transparent regions where the SVG has no fill (the
      // base map area), which would otherwise come out checkered when
      // pasted into Word/Slides.
      backgroundColor: "#ffffff",
    });

    // Crop to the rect bounds (account for pixelRatio scaling).
    const sx = rect.left * pixelRatio;
    const sy = rect.top * pixelRatio;
    const sw = rect.width * pixelRatio;
    const sh = rect.height * pixelRatio;

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext("2d");
    ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise((resolve) =>
      out.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    if (target === "clipboard") {
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
    } else {
      downloadBlob(blob, fileName);
    }
  } finally {
    restore.forEach(([el, prev]) => {
      el.style.visibility = prev;
    });
  }
}
