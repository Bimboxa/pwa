import { nanoid } from "@reduxjs/toolkit";
import { PDFDocument, PDFName, PDFObjectCopier } from "pdf-lib";

import db from "App/db/db";

import getArrayBufferSha256 from "Features/files/utils/getArrayBufferSha256";
import duplicateResourceToProject from "./duplicateResourceToProjectService";
import getResourceVisibility from "../utils/getResourceVisibility";

// A row usable from `projectId`: its own rows, plus GLOBAL rows (visible
// from every project — reused as is, never copied).
const isVisibleFromProject = (r, projectId) =>
  r.projectId === projectId || getResourceVisibility(r) === "GLOBAL";
import getPdfPageThumbnailDataUrl from "Features/detailFolio/utils/getPdfPageThumbnailDataUrl";

// Persists the PDF pages a base map is cut from as project resources
// (kind = "PDF_PAGE", visibility = "PROJECT"): one single-page PDF per source
// page, extracted with pdf-lib and stored in db.files under the standard
// resource convention. Dedup key = sha256(source bytes) + page number,
// scoped to the PROJECT (the RESOURCES panel lists a project's rows), so two
// base maps created from the same page of the same PDF (even in two
// sessions) share one resource. Returns Map<pageNumber, resourceRow>.
//
// Never throws. When pdf-lib cannot re-read the PDF (unusual xref, broken
// objects…), the WHOLE source PDF is kept instead as ONE resource (kind
// "PDF_SOURCE", sourceKey = hash@full) shared by every page; the returned
// entry then carries `pageInResource` = the original page number (1 for an
// extracted page). Only when even that fails is the page absent from the
// map — the base map creation must not fail because its source could not
// be kept. `failures` collects the errors for the caller's feedback.
export default async function ensurePdfPageResources({
  pdfFile,
  pdfDocument,
  pageNumbers,
  projectId,
  createdBy,
  failures = [],
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
    failures.push(e);
    return result;
  }

  const pdfFileName = pdfFile.name ?? "document.pdf";
  const baseName = pdfFileName.replace(/\.pdf$/i, "");
  const pageCount = pdfDocument?.numPages ?? null;

  let srcDoc = null;
  const getSrcDoc = async () => {
    if (!srcDoc) {
      srcDoc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      });
    }
    return srcDoc;
  };

  // Same content already kept in ANOTHER project: copy it into this one
  // (cheaper than re-extracting, and the panel lists a project's rows).
  const duplicateFromOtherProject = async (sourceKey) => {
    const twins = (
      await db.resources.where("sourceKey").equals(sourceKey).toArray()
    ).filter((r) => !r.deletedAt && r.fileName && !isVisibleFromProject(r, projectId));
    for (const twin of twins) {
      const copy = await duplicateResourceToProject(twin, { projectId, createdBy });
      if (copy) return copy;
    }
    return null;
  };

  // Fallback: the whole PDF as one resource (see header). Created once.
  let fullResource = null;
  const getFullResource = async () => {
    if (fullResource) return fullResource;
    const sourceKey = `${hash}@full`;
    const existing = (
      await db.resources.where("sourceKey").equals(sourceKey).toArray()
    ).filter((r) => !r.deletedAt && r.fileName && isVisibleFromProject(r, projectId));
    for (const r of existing) {
      const fileRecord = await db.files.get(r.fileName);
      if (fileRecord?.fileArrayBuffer) {
        fullResource = r;
        return r;
      }
    }
    const twinCopy = await duplicateFromOtherProject(sourceKey);
    if (twinCopy) {
      fullResource = twinCopy;
      return twinCopy;
    }
    if (existing[0]) {
      // metadata row without its file (post-Krto import): re-attach
      const r = existing[0];
      await db.transaction("rw", db.resources, db.files, async () => {
        await db.files.put({
          fileName: r.fileName,
          fileMime: "application/pdf",
          srcFileName: r.name,
          fileArrayBuffer: bytes.slice(0),
          projectId: r.projectId,
          fileType: "PDF",
        });
        await db.resources.update(r.id, { fileSize: bytes.byteLength });
      });
      fullResource = { ...r, fileSize: bytes.byteLength };
      return fullResource;
    }
    const id = nanoid();
    const name = pdfFileName;
    const fileName = `resource_${id}_${name}`;
    let thumbnail = null;
    try {
      if (pdfDocument) {
        thumbnail = await getPdfPageThumbnailDataUrl(pdfDocument, 1, 0);
      }
    } catch (e) {
      console.warn("[resources] page thumbnail failed", e);
    }
    const resource = {
      id,
      projectId,
      name,
      fileName,
      fileSize: bytes.byteLength,
      fileMime: "application/pdf",
      fileType: "PDF",
      thumbnail,
      createdBy,
      kind: "PDF_SOURCE",
      visibility: "PROJECT",
      sourceKey,
      source: { pdfFileName, pageCount },
    };
    await db.transaction("rw", db.resources, db.files, async () => {
      await db.files.put({
        fileName,
        fileMime: "application/pdf",
        srcFileName: name,
        fileArrayBuffer: bytes.slice(0),
        projectId,
        fileType: "PDF",
      });
      await db.resources.add(resource);
    });
    fullResource = resource;
    return resource;
  };

  for (const pageNumber of pages) {
    const sourceKey = `${hash}@p${pageNumber}`;
    try {
      // 1. Reuse an existing live resource with the same content key.
      const existing = (
        await db.resources.where("sourceKey").equals(sourceKey).toArray()
      ).filter((r) => !r.deletedAt && isVisibleFromProject(r, projectId));
      const reusable = existing.find((r) => r.fileName);
      if (reusable) {
        const fileRecord = await db.files.get(reusable.fileName);
        if (fileRecord?.fileArrayBuffer) {
          result.set(pageNumber, { ...reusable, pageInResource: 1 });
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
        result.set(pageNumber, {
          ...reusable,
          fileSize: pageBytes.byteLength,
          pageInResource: 1,
        });
        continue;
      }

      // 2. Same page already kept in another project: copy it here.
      const twinCopy = await duplicateFromOtherProject(sourceKey);
      if (twinCopy) {
        result.set(pageNumber, { ...twinCopy, pageInResource: 1 });
        continue;
      }

      // 3. Extract the page and create the resource.
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
      result.set(pageNumber, { ...resource, pageInResource: 1 });
    } catch (e) {
      console.error(
        `[resources] ensurePdfPageResources: page ${pageNumber} extraction failed, keeping the whole PDF`,
        e
      );
      try {
        const full = await getFullResource();
        result.set(pageNumber, { ...full, pageInResource: pageNumber });
      } catch (e2) {
        console.error(
          `[resources] ensurePdfPageResources: page ${pageNumber} skipped`,
          e2
        );
        failures.push(e2);
      }
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
