import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";
import findAutoDpi from "Features/pdf/utils/findAutoDpi";

// resolution null => AUTO (findAutoDpi). Returns { imageFile, meterByPx, dpi }
// — dpi is the resolution actually used, persisted in the baseMap's
// createdFrom so the render could be replayed identically later.
export default async function renderTempBaseMapImage({
  pdfFile,
  pdfDocument,
  page,
  bboxInRatio,
  rotate,
  blueprintScale,
  resolution = null,
}) {
  if (resolution == null) {
    const { dpi, probeBlob } = await findAutoDpi({
      pdfFile,
      pdfDocument,
      page,
      bboxInRatio,
      rotate,
    });
    if (probeBlob) {
      const base = (pdfFile?.name ?? "page").replace(".pdf", "");
      const imageFile = new File([probeBlob], `${base}_page${page}_auto.png`, {
        type: "image/png",
      });
      const meterByPx = blueprintScale
        ? (0.0254 / dpi) * Number(blueprintScale)
        : null;
      return { imageFile, meterByPx, dpi };
    }
    const result = await pdfToPngAsync({
      pdfFile,
      pdfDocument,
      page,
      bboxInRatio,
      resolution: dpi,
      rotate,
      blueprintScale,
    });
    return { ...result, dpi };
  }
  const result = await pdfToPngAsync({
    pdfFile,
    pdfDocument,
    page,
    bboxInRatio,
    resolution,
    rotate,
    blueprintScale,
  });
  return { ...result, dpi: resolution };
}
