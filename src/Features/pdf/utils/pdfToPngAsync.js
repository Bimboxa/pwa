import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function renderPageToPngBlob({
  pdfPage,
  resolution = 72,
  bboxInRatio,
  rotate = 0,
}) {
  const scale = resolution / 72;
  const viewport = pdfPage.getViewport({ scale, rotation: rotate });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  let offsetX = 0;
  let offsetY = 0;

  if (bboxInRatio) {
    const { x1, y1, x2, y2 } = bboxInRatio;
    const rawWidth = viewport.width;
    const rawHeight = viewport.height;

    const cropX = x1 * rawWidth;
    const cropY = y1 * rawHeight;
    const cropWidth = (x2 - x1) * rawWidth;
    const cropHeight = (y2 - y1) * rawHeight;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    offsetX = -cropX;
    offsetY = -cropY;
  } else {
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  }

  if (offsetX !== 0 || offsetY !== 0) {
    context.translate(offsetX, offsetY);
  }

  await pdfPage.render({ canvasContext: context, viewport }).promise;

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );

  return { blob, width: canvas.width, height: canvas.height };
}

export default async function pdfToPngAsync({
  pdfFile,
  pdfDocument,
  page = 1,
  bboxInRatio,
  resolution = 72,
  rotate = 0,
  blueprintScale = null,
}) {
  let ownedUrl = null;
  let pdf = pdfDocument;

  try {
    if (!pdf) {
      ownedUrl = URL.createObjectURL(pdfFile);
      const loadingTask = getDocument(ownedUrl);
      pdf = await loadingTask.promise;
    }

    const pdfPage = await pdf.getPage(page);

    const { blob, width, height } = await renderPageToPngBlob({
      pdfPage,
      resolution,
      bboxInRatio,
      rotate,
    });

    const sourceName = pdfFile?.name ?? "page";
    const pdfFileName = sourceName.replace(".pdf", "");
    const suffix = bboxInRatio ? "_crop" : "";
    const rotSuffix = rotate > 0 ? `_r${rotate}` : "";
    const name = `${pdfFileName}_page${page}${rotSuffix}${suffix}.png`;

    const blobUrl = URL.createObjectURL(blob);
    const pngFile = await imageUrlToPng({ url: blobUrl, name });
    URL.revokeObjectURL(blobUrl);

    let meterByPx = null;
    if (blueprintScale) {
      const _blueprintScale = Number(blueprintScale);
      meterByPx = (0.0254 / resolution) * _blueprintScale;
    }

    console.log("[pdfToPng]", {
      resolution,
      width,
      height,
      bytes: blob.size,
      meterByPx,
    });

    return { imageFile: pngFile, meterByPx, width, height, blob };
  } catch (error) {
    console.error("Erreur lors de la conversion du PDF :", error);
    throw error;
  } finally {
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
  }
}
