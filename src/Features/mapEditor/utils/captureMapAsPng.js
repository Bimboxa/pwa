import * as htmlToImage from "html-to-image";

import downloadBlob from "Features/files/utils/downloadBlob";

import getCaptureRectBounds from "./getCaptureRectBounds";

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
  whiteBackground = false,
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
    // Restore every descendant's visibility to whatever it was before.
    restoreList.forEach(([el, v]) => {
      el.style.visibility = v;
    });
  }
}
