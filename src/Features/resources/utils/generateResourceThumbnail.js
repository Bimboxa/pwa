import generateThumbnail from "Features/images/utils/generateThumbnail";
import generatePageThumbnailAsync from "Features/pdf/utils/generatePageThumbnailAsync";
import testIsPdf from "Features/pdf/utils/testIsPdf";
import testIsImage from "Features/files/utils/testIsImage";

const THUMBNAIL_SIZE = 128;

// Square cover-crop resize of a dataURL image (same logic as generateThumbnail,
// which only accepts a File). Keeps PDF page renders small: the thumbnails are
// stored inline on the resource rows and ship in the Krto JSON.
function resizeDataUrlToSquare(dataUrl, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = size;
      canvas.height = size;
      const scale = Math.max(size / img.width, size / img.height);
      const x = size / 2 - (img.width / 2) * scale;
      const y = size / 2 - (img.height / 2) * scale;
      ctx.fillStyle = "#ffffff"; // PDF pages have no background
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      resolve(canvas.toDataURL("image/webp", 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Inline base64 thumbnail for a resource file: square cover crop for images,
// first page render for PDFs, null for files with no preview (DWG…).
export default async function generateResourceThumbnail(file) {
  try {
    if (testIsImage(file)) return await generateThumbnail(file, THUMBNAIL_SIZE);
    if (testIsPdf(file)) {
      const pageDataUrl = await generatePageThumbnailAsync({
        pdfFile: file,
        scale: 0.3,
        pageNumber: 1,
      });
      if (!pageDataUrl) return null;
      return await resizeDataUrlToSquare(pageDataUrl, THUMBNAIL_SIZE);
    }
  } catch (e) {
    console.log("[resources] thumbnail generation failed", e);
  }
  return null;
}
