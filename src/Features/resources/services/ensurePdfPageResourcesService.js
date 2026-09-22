import { nanoid } from "@reduxjs/toolkit";
import { PDFDocument, PDFName, PDFObjectCopier } from "pdf-lib";

import db from "App/db/db";

import getArrayBufferSha256 from "Features/files/utils/getArrayBufferSha256";
import getPdfPageThumbnailDataUrl from "Features/detailFolio/utils/getPdfPageThumbnailDataUrl";

// Persists the PDF pages a base map is cut from as project resources
// (kind = "PDF_PAGE", visibility = "PROJECT"): one single-page PDF per source
// page, extracted with pdf-lib and stored in db.files under the standard
// resource convention. Dedup key = sha256(source bytes) + page number, so
// two base maps created from the same page of the same PDF (even in two
// sessions) share one resource. Returns Map<pageNumber, resourceRow>.
//
// Never throws: an extraction failure (encrypted / corrupt PDF) is logged
// and the page is simply absent from the map — the base map creation must
// not fail because its source could not be kept.
export default async function ensurePdfPageResources({
  pdfFile,
  pdfDocument,
  pageNumbers,
  projectId,
  createdBy,
}) {
  const result = new Map();
  const pages = [...new Set((pageNumbers ?? []).filter((p) => p >= 1))];
  if (!pdfFile || !projectId || pages.length === 0) return result;

  let bytes;
  let hash;
  try {
    bytes = await pdfFile.arrayBuffer();
    hash = await getArrayBufferSha256(bytes, pdfFile);
  } catch (e) {
    console.error("[resources] ensurePdfPageResources: read failed", e);
    return result;
  }

  const pdfFileName = pdfFile.name ?? "document.pdf";
  const baseName = pdfFileName.replace(/\.pdf$/i, "");
  const pageCount = pdfDocument?.numPages ?? null;

  let srcDoc = null;
  const getSrcDoc = async () => {
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    return srcDoc;
  };

  for (const pageNumber of pages) {
    const sourceKey = `${hash}@p${pageNumber}`;
    try {
      // 1. Reuse an existing live resource with the same content key.
      const existing = (
        await db.resources.where("sourceKey").equals(sourceKey).toArray()
      ).filter((r) => !r.deletedAt);
      const reusable = existing.find((r) => r.fileName);
      if (reusable) {
        const fileRecord = await db.files.get(reusable.fileName);
        if (fileRecord?.fileArrayBuffer) {
          result.set(pageNumber, reusable);
          continue;
        }
        // Metadata row without its file (post-Krto-import): re-extract the
        // page under the SAME fileName (same as useReattachResourceFile).
        const pageBytes = await extractPage(await getSrcDoc(), pageNumber);
        await db.transaction("rw", db.resources, db.files, async () => {
          await db.files.put({
            fileName: reusable.fileName,
            fileMime: "application/pdf",
            srcFileName: reusable.name,
            fileArrayBuffer: pageBytes,
            projectId: reusable.projectId,
            fileType: "PDF",
          });
          await db.resources.update(reusable.id, {
            fileSize: pageBytes.byteLength,
            fileMime: "application/pdf",
          });
        });
        result.set(pageNumber, { ...reusable, fileSize: pageBytes.byteLength });
        continue;
      }

      // 2. Extract the page and create the resource.
      const pageBytes = await extractPage(await getSrcDoc(), pageNumber);
      const id = nanoid();
      const name = `${baseName} — p.${pageNumber}.pdf`;
      const fileName = `resource_${id}_${name}`;

      let thumbnail = null;
      let pageWidthPt = null;
      let pageHeightPt = null;
      if (pdfDocument) {
        try {
          const page = await pdfDocument.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          pageWidthPt = viewport.width;
          pageHeightPt = viewport.height;
          thumbnail = await getPdfPageThumbnailDataUrl(pdfDocument, pageNumber, 0);
        } catch (e) {
          console.warn("[resources] page thumbnail failed", e);
        }
      }

      const resource = {
        id,
        projectId,
        name,
        fileName,
        fileSize: pageBytes.byteLength,
        fileMime: "application/pdf",
        fileType: "PDF",
        thumbnail,
        createdBy,
        kind: "PDF_PAGE",
        visibility: "PROJECT",
        sourceKey,
        source: {
          pdfFileName,
          pageNumber,
          pageCount,
          pageWidthPt,
          pageHeightPt,
        },
      };

      await db.transaction("rw", db.resources, db.files, async () => {
        await db.files.put({
          fileName,
          fileMime: "application/pdf",
          srcFileName: name,
          fileArrayBuffer: pageBytes,
          projectId,
          fileType: "PDF",
        });
        await db.resources.add(resource);
      });
      result.set(pageNumber, resource);
    } catch (e) {
      console.error(
        `[resources] ensurePdfPageResources: page ${pageNumber} skipped`,
        e
      );
    }
  }

  return result;
}

// Copies one page (1-based) into a fresh document. copyPages bakes the
// inherited Resources / MediaBox / CropBox / Rotate into the copied leaf, so
// pdfjs computes the same viewport as on the source page. The catalog's
// optional-content config (CAD layers hidden by default) is not part of the
// page tree: copy it too when present, otherwise hidden layers would render.
async function extractPage(srcDoc, pageNumber) {
  const dest = await PDFDocument.create();
  const [page] = await dest.copyPages(srcDoc, [pageNumber - 1]);
  dest.addPage(page);
  try {
    const ocKey = PDFName.of("OCProperties");
    const oc = srcDoc.catalog.lookup(ocKey);
    if (oc) {
      const copier = PDFObjectCopier.for(srcDoc.context, dest.context);
      dest.catalog.set(ocKey, copier.copy(oc));
    }
  } catch (e) {
    console.warn("[resources] OCProperties copy skipped", e);
  }
  const saved = await dest.save({ useObjectStreams: false });
  // Uint8Array → standalone ArrayBuffer (no shared offset).
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength);
}
