import db from "App/db/db";

const DEFAULT_MAX_LONG_EDGE = 1600;
const DEFAULT_JPEG_QUALITY = 0.8;

async function getBaseMapBlob(baseMap) {
  const url = baseMap?.getUrl?.();
  if (url) {
    const res = await fetch(url);
    if (res.ok) return res.blob();
  }
  // Fallback: raw bytes from db.files (BaseMap.createFromRecord pattern).
  const fileName =
    baseMap?.getActiveVersion?.()?.image?.fileName ?? baseMap?.image?.fileName;
  if (fileName) {
    const record = await db.files.get(fileName);
    if (record?.fileArrayBuffer) {
      return new Blob([record.fileArrayBuffer], {
        type: record.fileMime || "image/png",
      });
    }
  }
  throw new Error("Image du fond de plan introuvable.");
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      mime,
      quality
    );
  });
}

/**
 * Picture of the base map IN ITS REFERENCE FRAME, downscaled (long edge ≤
 * maxLongEdge) as JPEG for the relay.
 *
 * Annotations are normalized against the reference frame
 * (`getImageSize()` = refWidth × refHeight), not against the pixels of the
 * active version: a version is an image placed in that frame by its
 * `transform` {x, y, scale, rotation} — the editor draws it with
 * `translate(x, y) scale(scale) rotate(rotation)` (StaticMapContent). The same
 * placement is reproduced here, so normalized [0..1] coordinates read on the
 * published picture are reference coordinates whatever the active version
 * (original, enhanced, re-scanned, shifted…). Areas of the frame the version
 * does not cover stay white.
 *
 * @returns {Promise<{base64: string, mime: string, width: number, height: number}>}
 */
export default async function buildBaseMapSnapshotImage({
  baseMap,
  maxLongEdge = DEFAULT_MAX_LONG_EDGE,
  jpegQuality = DEFAULT_JPEG_QUALITY,
  mime = "image/jpeg",
}) {
  const blob = await getBaseMapBlob(baseMap);
  const bitmap = await createImageBitmap(blob);
  try {
    const ref = baseMap?.getImageSize?.();
    const refWidth = ref?.width > 0 ? ref.width : bitmap.width;
    const refHeight = ref?.height > 0 ? ref.height : bitmap.height;
    const t = baseMap?.getActiveVersionTransform?.() ?? {};

    const k = Math.min(1, maxLongEdge / Math.max(refWidth, refHeight));
    const width = Math.max(1, Math.round(refWidth * k));
    const height = Math.max(1, Math.round(refHeight * k));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    // JPEG has no alpha: flatten on white so transparent plans stay readable.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    // reference px → canvas px, then the version placement (SVG order).
    ctx.scale(width / refWidth, height / refHeight);
    ctx.translate(t.x ?? 0, t.y ?? 0);
    ctx.scale(t.scale ?? 1, t.scale ?? 1);
    ctx.rotate(((t.rotation ?? 0) * Math.PI) / 180);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0);

    const out = await canvasToBlob(
      canvas,
      mime,
      mime === "image/jpeg" ? jpegQuality : undefined
    );
    return { base64: await blobToBase64(out), mime, width, height };
  } finally {
    bitmap.close?.();
  }
}
