import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import renderTempBaseMapImage from "Features/baseMapCreator/utils/renderTempBaseMapImage";

import parseBlueprintScale from "../utils/parseBlueprintScale";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MIN_DPI = 72;
const MAX_DPI = 600;

/**
 * Rasterizes the page/crop described by a relay base map job with the SAME
 * pipeline as the local PDF creator (renderTempBaseMapImage → pdfToPngAsync /
 * findAutoDpi): absolute rotation, crop on the rotated page, AUTO dpi when the
 * job leaves it null. Returns what useCreateBaseMaps needs plus `createdFrom`
 * (same shape as ButtonCreateBaseMaps, plus the relay provenance).
 */
export default async function renderBaseMapJobImage({
  pdfBlob,
  pdfFileName,
  frame,
  relay,
}) {
  const pdfFile = new File([pdfBlob], pdfFileName || "document.pdf", {
    type: "application/pdf",
  });
  const data = await pdfFile.arrayBuffer();
  const pdfDocument = await getDocument({ data, ...PDFJS_DOC_PARAMS }).promise;
  try {
    const page = Number(frame?.pageNumber ?? 1);
    if (!(page >= 1 && page <= pdfDocument.numPages)) {
      throw new Error(
        `Page ${page} inexistante (le PDF a ${pdfDocument.numPages} page(s)).`
      );
    }
    const rotate = [0, 90, 180, 270].includes(Number(frame?.rotation))
      ? Number(frame.rotation)
      : 0;
    const bboxInRatio = frame?.bboxInRatio ?? { x1: 0, y1: 0, x2: 1, y2: 1 };
    const blueprintScale = parseBlueprintScale(frame?.blueprintScale);
    const resolution =
      frame?.dpi != null
        ? Math.min(MAX_DPI, Math.max(MIN_DPI, Math.round(Number(frame.dpi))))
        : null;

    const { imageFile, meterByPx, dpi } = await renderTempBaseMapImage({
      pdfFile,
      pdfDocument,
      page,
      bboxInRatio,
      rotate,
      blueprintScale,
      resolution,
    });

    return {
      imageFile,
      meterByPx,
      dpi,
      createdFrom: {
        type: "PDF_PAGE",
        pdfFileName: pdfFile.name,
        resourceId: null,
        pageNumber: page,
        rotation: rotate,
        bboxInRatio,
        dpi,
        blueprintScale: blueprintScale || null,
        // Relay provenance: lets the PWA recognise a base map already created
        // for this job (retry after a lost ack) and republish with its PDF
        // frame so ChatGPT can submit annotations in PDF user space.
        relay: relay ?? null,
      },
    };
  } finally {
    pdfDocument.destroy();
  }
}
