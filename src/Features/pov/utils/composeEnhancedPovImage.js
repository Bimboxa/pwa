import { roundedRectPath } from "Features/mapEditor/utils/captureMapAsPng";
import {
  CAPTURE_BORDER_INSET,
  CAPTURE_BORDER_RADIUS,
} from "Features/mapEditor/utils/captureBorderConstants";

// Final image of the POV "Amélioration IA" flow: the AI-enhanced image kept
// at its native resolution (never recompressed / resized), with the captured
// decor overlay (border + title + watermark + logo, transparent elsewhere)
// stretched on top, and the rounded-border transparency re-applied when the
// border option is on. Returns a PNG blob (the enhanced blob as-is when
// there is no decor to compose).
export default async function composeEnhancedPovImage({
  enhancedBlob,
  decorBlob,
  roundedBorderMask = false,
  decorPixelRatio = 2, // pixelRatio the decor overlay was captured at
}) {
  if (!enhancedBlob) return null;
  if (!decorBlob && !roundedBorderMask) return enhancedBlob;

  const enhancedImg = await loadImageFromBlob(enhancedBlob);
  const decorImg = decorBlob ? await loadImageFromBlob(decorBlob) : null;

  const canvas = document.createElement("canvas");
  canvas.width = enhancedImg.naturalWidth;
  canvas.height = enhancedImg.naturalHeight;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(enhancedImg, 0, 0);
  if (decorImg) {
    ctx.drawImage(decorImg, 0, 0, canvas.width, canvas.height);
  }

  // Border mask geometry is defined in capture-rect CSS px: recover that
  // scale from the decor capture (rect width × decorPixelRatio) and map it
  // to the enhanced image resolution.
  if (roundedBorderMask && decorImg) {
    const factor = canvas.width / (decorImg.naturalWidth / decorPixelRatio);
    const inset = CAPTURE_BORDER_INSET * factor;
    const radius = CAPTURE_BORDER_RADIUS * factor;
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    roundedRectPath(
      ctx,
      inset,
      inset,
      Math.max(0, canvas.width - 2 * inset),
      Math.max(0, canvas.height - 2 * inset),
      radius
    );
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  return blob ?? enhancedBlob;
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
