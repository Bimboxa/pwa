import db from "App/db/db";

import downloadBlob from "Features/files/utils/downloadBlob";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import { getPdfPageSize } from "Features/mapEditor/utils/captureMapAsPng";

// Exports a POV image already stored in db.files (the saved AI-transformed
// image) with the same output modes as captureMapAsPng: png / pdf download
// or clipboard copy. Returns false when the stored file is missing so the
// caller can fall back to a fresh capture.
export default async function exportPovImageService({
  storedFileName,
  mode, // "png" | "pdf" | "clipboard"
  fileName = "point_de_vue.png",
  aspectRatio = "LANDSCAPE",
}) {
  const fileRecord = await db.files.get(storedFileName);
  if (!fileRecord?.fileArrayBuffer) return false;

  const blob = new Blob([fileRecord.fileArrayBuffer], {
    type: fileRecord.fileMime || "image/png",
  });

  if (mode === "clipboard") {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      downloadBlob(blob, fileName);
      return true;
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  }

  if (mode === "pdf") {
    const url = URL.createObjectURL(blob);
    try {
      const { pageWidth, pageHeight } = getPdfPageSize(aspectRatio);
      const pdfFile = await imageToPdfAsync({ url, pageWidth, pageHeight });
      downloadBlob(pdfFile, fileName);
    } finally {
      URL.revokeObjectURL(url);
    }
    return true;
  }

  downloadBlob(blob, fileName);
  return true;
}
