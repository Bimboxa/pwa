/**
 * Replace all pixels matching `sourceColorHex` (within a tolerance) with `targetColorHex`.
 * Uses Euclidean distance in RGB space.
 *
 * @param {string} imageUrl - URL of the source image
 * @param {string} sourceColorHex - Hex color to replace (e.g. "#3A6BC5")
 * @param {string} targetColorHex - Replacement hex color (e.g. "#FFFFFF")
 * @param {number} [tolerance=30] - Max Euclidean RGB distance to match
 * @returns {Promise<File>} - PNG file with replaced colors
 */
export default async function replaceColorInImage(
  imageUrl,
  sourceColorHex,
  targetColorHex,
  tolerance = 30
) {
  const [srcR, srcG, srcB] = hexToRgb(sourceColorHex);
  const [tgtR, tgtG, tgtB] = hexToRgb(targetColorHex);
  const tolSq = tolerance * tolerance;

  const img = await loadImage(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - srcR;
    const dg = data[i + 1] - srcG;
    const db = data[i + 2] - srcB;
    if (dr * dr + dg * dg + db * db <= tolSq) {
      data[i] = tgtR;
      data[i + 1] = tgtG;
      data[i + 2] = tgtB;
      // keep alpha unchanged
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new File([blob], "color_replaced.png", { type: "image/png" });
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load image: " + err));
    img.src = url;
  });
}
