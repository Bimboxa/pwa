import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import db from "App/db/db";

import ImageObject from "Features/images/js/ImageObject";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import { renderPageToPngBlob } from "Features/pdf/utils/pdfToPngAsync";
import {
  getDetailImageCacheKey,
  resolveDetailResource,
} from "./detailBaseMapUtils";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Single-flight guard: useBaseMap/useMainBaseMap run one liveQuery PER
// consuming component, so a cold cache would otherwise fire one full PDF
// render (buffer copy + worker + huge canvas) per component simultaneously —
// enough to crash the tab. All concurrent callers share one render promise.
const inflightByKey = new Map();

// Regenerates the image of a detail baseMap from its source PDF, replaying
// createdFrom exactly (dpi, rotation, crop) so the pixel size always matches
// refWidth/refHeight. Returns an ImageObject, or null when the PDF is absent
// (deleted resource, post-Krto-import before the file is re-attached).
export default function renderDetailBaseMapImage(record) {
  const key = getDetailImageCacheKey(record) ?? record?.id;
  let promise = inflightByKey.get(key);
  if (!promise) {
    promise = _renderDetailBaseMapImage(record).finally(() =>
      inflightByKey.delete(key)
    );
    inflightByKey.set(key, promise);
  }
  return promise;
}

async function _renderDetailBaseMapImage(record) {
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
