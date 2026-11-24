// Re-encodes a heavy image file (the PNGs an AI chat returns for an
// orthomosaic weigh tens of MB) into a lighter format, at the same pixel
// size. Browser-only (canvas).
//
// - `type` "image/jpeg": no transparency — `background` (white by default)
//   fills the transparent areas. For the mosaic, the base map image: read at
//   every page load and shipped in the Krto zip.
// - `type` "image/webp": keeps the transparency. For the unit orthophotos.
//
// Returns the ORIGINAL file when it is small already, when the browser cannot
// encode `type`, or when the result is not clearly lighter.

const MIN_BYTES = 3 * 1024 * 1024;
const MIN_GAIN = 0.8; // keep the result only under 80 % of the original
const EXTENSIONS = { "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_WEBP_DIM = 16383;

export default async function compressImageFile(
  file,
  { type = "image/jpeg", quality = 0.9, background = "#ffffff" } = {}
) {
  if (!file || file.size < MIN_BYTES || file.type === type) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const { width, height } = bitmap;
    if (
      type === "image/webp" &&
      (width > MAX_WEBP_DIM || height > MAX_WEBP_DIM)
    ) {
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    if (type === "image/jpeg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, type, quality)
    );
    // an unsupported type silently falls back to PNG
    if (!blob || blob.type !== type || blob.size > file.size * MIN_GAIN) {
      return file;
    }
    const baseName = String(file.name ?? "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.${EXTENSIONS[type]}`, { type });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}
