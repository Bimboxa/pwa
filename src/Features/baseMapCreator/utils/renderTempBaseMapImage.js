import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";
import findAutoDpi from "Features/pdf/utils/findAutoDpi";

// resolution null => AUTO (findAutoDpi). Returns { imageFile, meterByPx }.
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
      return { imageFile, meterByPx };
    }
    return pdfToPngAsync({
      pdfFile,
      pdfDocument,
      page,
      bboxInRatio,
      resolution: dpi,
      rotate,
      blueprintScale,
    });
  }
  return pdfToPngAsync({
    pdfFile,
    pdfDocument,
    page,
    bboxInRatio,
    resolution,
    rotate,
    blueprintScale,
  });
}
