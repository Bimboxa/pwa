import { nanoid } from "@reduxjs/toolkit";
import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

import db from "App/db/db";
import editor from "App/editor";

import ImageObject from "Features/images/js/ImageObject";
import getDateString from "Features/misc/utils/getDateString";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import { renderPageToPngBlob } from "Features/pdf/utils/pdfToPngAsync";
import findAutoDpi from "Features/pdf/utils/findAutoDpi";
import getPdfPageThumbnailDataUrl from "Features/detailFolio/utils/getPdfPageThumbnailDataUrl";
import { getDetailImageCacheKey } from "./detailBaseMapUtils";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Finds the detail baseMap matching a (pdf file name, page) pair, or creates
// it. Detail baseMaps store NO file in db.files: their image is rendered on
// the fly from the source PDF (see BaseMap.createFromRecord) and cached in
// memory for the session. Dedup deliberately ignores rotation — the rotation
// of the first drop wins, so annotations placed on the detail stay aligned.
// Returns the db.baseMaps record, or null when the PDF is not available.
export default async function findOrCreateDetailBaseMap({
  resourceId,
  pageNumber,
  rotation = 0,
  projectId,
  createdBy,
}) {
  const resource = await db.resources.get(resourceId);
  if (!resource || resource.deletedAt) return null;
  const pdfFileName = resource.name;

  const existing = await db.baseMaps
    .where("projectId")
    .equals(projectId)
    .filter(
      (r) =>
        !r.deletedAt &&
        r.isDetail &&
        r.createdFrom?.pdfFileName === pdfFileName &&
        r.createdFrom?.pageNumber === pageNumber
    )
    .first();
  if (existing) return existing;

  const fileRecord = resource.fileName
    ? await db.files.get(resource.fileName)
    : null;
  if (!fileRecord?.fileArrayBuffer) return null;

  // pdfjs transfers the buffer to its worker (detaching it): pass a copy.
  const loadingTask = getDocument({
    data: fileRecord.fileArrayBuffer.slice(0),
    ...PDFJS_DOC_PARAMS,
  });
  const pdfDocument = await loadingTask.promise;
  try {
    // Same size discipline as the baseMapCreator flow: findAutoDpi targets a
    // 1-5 MB PNG and caps the short side — a fixed dpi on a dense page can
    // produce a tab-crashing image. The dpi is chosen ONCE here and persisted
    // in createdFrom.dpi: regeneration always replays it so the rendered
    // pixel size matches refWidth/refHeight (the annotations' frame) forever.
    const { dpi, probeBlob, probeWidth, probeHeight } = await findAutoDpi({
      pdfDocument,
      page: pageNumber,
      rotate: rotation,
    });

    // Single full-resolution render (the probe is reused when already on
    // target): gives the exact pixel size (canvas truncation included) for
    // refWidth/refHeight AND primes the session cache — no re-render at
    // first selection.
    let blob, width, height;
    if (probeBlob) {
      blob = probeBlob;
      width = probeWidth;
      height = probeHeight;
    } else {
      const pdfPage = await pdfDocument.getPage(pageNumber);
      const rendered = await renderPageToPngBlob({
        pdfPage,
        resolution: dpi,
        rotate: rotation,
      });
      blob = rendered.blob;
      width = rendered.width;
      height = rendered.height;
    }
    const thumbnail = await getPdfPageThumbnailDataUrl(
      pdfDocument,
      pageNumber,
      rotation
    );

    const record = {
      id: nanoid(),
      createdAt: getDateString(Date.now()),
      createdBy,
      projectId,
      listingId: null, // detail baseMaps belong to no baseMap listing
      isDetail: true,
      name: `${pdfFileName.replace(/\.pdf$/i, "")} — p.${pageNumber}`,
      createdFrom: {
        type: "PDF_PAGE",
        pdfFileName,
        resourceId,
        pageNumber,
        rotation,
        bboxInRatio: null,
        dpi,
        blueprintScale: null,
      },
      // No image.fileName → nothing in db.files, regenerated on the fly.
      image: { thumbnail, imageSize: { width, height }, isImage: true },
      refWidth: width,
      refHeight: height,
      meterByPx: null,
    };
    await db.baseMaps.add(record);

    const imageFile = new File([blob], `${record.name}.png`, {
      type: "image/png",
    });
    const image = await ImageObject.create({ imageFile, thumbnail });
    editor.baseMapsCache = editor.baseMapsCache || {};
    editor.baseMapsCache[record.id] = {
      imageKey: getDetailImageCacheKey(record),
      image,
      imageEnhancedKey: null,
      imageEnhanced: null,
    };

    return record;
  } finally {
    pdfDocument.destroy();
  }
}
