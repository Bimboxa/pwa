import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import db from "App/db/db";

import ImageObject from "Features/images/js/ImageObject";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import { renderPageToPngBlob } from "Features/pdf/utils/pdfToPngAsync";
import { resolveDetailResource } from "./detailBaseMapUtils";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Regenerates the image of a detail baseMap from its source PDF, replaying
// createdFrom exactly (dpi, rotation, crop) so the pixel size always matches
// refWidth/refHeight. Returns an ImageObject, or null when the PDF is absent
// (deleted resource, post-Krto-import before the file is re-attached).
export default async function renderDetailBaseMapImage(record) {
  const { createdFrom } = record;
  if (!createdFrom) return null;

  const resource = await resolveDetailResource({
    createdFrom,
    projectId: record.projectId,
  });
  if (!resource) return null;

  const fileRecord = await db.files.get(resource.fileName);
  if (!fileRecord?.fileArrayBuffer) return null;

  // pdfjs transfers the buffer to its worker (detaching it): pass a copy.
  const loadingTask = getDocument({
    data: fileRecord.fileArrayBuffer.slice(0),
    ...PDFJS_DOC_PARAMS,
  });
  const pdfDocument = await loadingTask.promise;
  try {
    const pdfPage = await pdfDocument.getPage(createdFrom.pageNumber);
    const { blob } = await renderPageToPngBlob({
      pdfPage,
      resolution: createdFrom.dpi,
      bboxInRatio: createdFrom.bboxInRatio,
      rotate: createdFrom.rotation ?? 0,
    });
    const imageFile = new File([blob], `${record.name}.png`, {
      type: "image/png",
    });
    // Passing the stored thumbnail skips its regeneration.
    return await ImageObject.create({
      imageFile,
      thumbnail: record.image?.thumbnail,
    });
  } catch (e) {
    console.error("[baseMaps] renderDetailBaseMapImage error", e);
    return null;
  } finally {
    pdfDocument.destroy();
  }
}
