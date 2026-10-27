// Lightweight inline preview of an image: WebP data URL, aspect ratio kept,
// longest side capped at maxSide (never upscaled). Unlike generateThumbnail
// (32px square, cover-cropped avatar), the preview can stand in for the
// full image in the map editor — the base map of a folder hidden in the
// scope ships without its db.files row in the Krto zip (see createKrtoZip),
// so the preview is what the importing device draws under the annotations.
export const PREVIEW_MAX_SIDE = 640;

export default async function generateImagePreview(
  file,
  maxSide = PREVIEW_MAX_SIDE
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/webp", 0.7));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
