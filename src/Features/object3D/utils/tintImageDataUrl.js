/**
 * Flat-fills every opaque pixel of an image with `color`, keeping the source
 * alpha channel (antialiased silhouette). Returns a PNG data URL, or null when
 * the image cannot be loaded / drawn.
 */
export default function tintImageDataUrl(dataUrl, color) {
  return new Promise((resolve) => {
    if (!dataUrl || !color) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        console.warn("[tintImageDataUrl] tint failed", e);
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}
