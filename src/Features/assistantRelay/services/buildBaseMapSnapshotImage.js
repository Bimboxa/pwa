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
 * Render the baseMap image downscaled (long edge ≤ maxLongEdge) as JPEG for
 * the relay. The downscale keeps the aspect ratio, so normalized [0..1]
 * coordinates computed on it map straight onto the reference size.
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
    const scale = Math.min(
      1,
      maxLongEdge / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    // JPEG has no alpha: flatten on white so transparent plans stay readable.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

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
