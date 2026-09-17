import { nanoid } from "@reduxjs/toolkit";

export const CHAT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_CHAT_IMAGES = 4;

const MAX_LONG_EDGE = 1600;
const THUMB_EDGE = 160;
// A downscaled PNG above this weight (photos) is sent as JPEG instead.
const MAX_PNG_BYTES = 1_500_000;

export function isChatImageFile(file) {
  return (
    CHAT_IMAGE_TYPES.includes(file?.type) ||
    /\.(png|jpe?g|webp)$/i.test(file?.name ?? "")
  );
}

function draw(bitmap, longEdge, { opaque } = {}) {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (opaque) {
    // JPEG has no alpha: transparent pixels would turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

const base64Of = (dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1);
const bytesOf = (base64) => Math.floor((base64.length * 3) / 4);

// A picture attached to a chat message, ready for the relay: downscaled to
// what a vision model uses anyway (long edge ≤ 1600 px), PNG kept for
// drawings and screenshots, JPEG for heavy photos. `thumbUrl` is the small
// preview kept in the conversation.
// Returns { id, name, mime, base64, width, height, thumbUrl }.
export default async function prepareChatImage(file) {
  if (!isChatImageFile(file)) {
    const e = new Error("Format d'image non pris en charge (PNG, JPEG, WebP).");
    e.code = "UNSUPPORTED_IMAGE";
    throw e;
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const e = new Error("Image illisible.");
    e.code = "UNREADABLE_IMAGE";
    throw e;
  }
  try {
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name ?? "");
    let mime = "image/jpeg";
    let base64 = null;
    let canvas = null;
    if (isPng) {
      canvas = draw(bitmap, MAX_LONG_EDGE);
      const png = base64Of(canvas.toDataURL("image/png"));
      if (bytesOf(png) <= MAX_PNG_BYTES) {
        mime = "image/png";
        base64 = png;
      }
    }
    if (!base64) {
      canvas = draw(bitmap, MAX_LONG_EDGE, { opaque: true });
      base64 = base64Of(canvas.toDataURL("image/jpeg", 0.85));
    }
    const thumbUrl = draw(bitmap, THUMB_EDGE, { opaque: true }).toDataURL(
      "image/jpeg",
      0.8
    );
    return {
      id: nanoid(),
      name: file.name || "image",
      mime,
      base64,
      width: canvas.width,
      height: canvas.height,
      thumbUrl,
    };
  } finally {
    bitmap.close?.();
  }
}
