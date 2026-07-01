import { getDocument } from "pdfjs-dist";
import { renderPageToPngBlob } from "./pdfToPngAsync";
import { PDFJS_DOC_PARAMS } from "./pdfjsParams";

const PROBE_DPI = 100;
const MIN_DPI = 72;
const MAX_DPI = 600;
const TARGET_MB = 3;
const MIN_MB = 1;
const MAX_MB = 5;
const MIN_SHORT_SIDE_CAP = 5000;

const MB = 1024 * 1024;

export default async function findAutoDpi({
  pdfFile,
  pdfDocument,
  page = 1,
  bboxInRatio,
  rotate = 0,
}) {
  let ownedUrl = null;
  let pdf = pdfDocument;

  try {
    if (!pdf) {
      ownedUrl = URL.createObjectURL(pdfFile);
      pdf = await getDocument({ url: ownedUrl, ...PDFJS_DOC_PARAMS }).promise;
    }
    const pdfPage = await pdf.getPage(page);

    const probe = await renderPageToPngBlob({
      pdfPage,
      resolution: PROBE_DPI,
      bboxInRatio,
      rotate,
    });

    const probeBytes = probe.blob.size;
    const probePixels = probe.width * probe.height;
    const bytesPerPixel = probeBytes / Math.max(probePixels, 1);

    const targetPixels = (TARGET_MB * MB) / Math.max(bytesPerPixel, 1e-6);
    const scaleFactor = Math.sqrt(targetPixels / Math.max(probePixels, 1));

    let autoDpi = PROBE_DPI * scaleFactor;
    autoDpi = Math.max(MIN_DPI, Math.min(MAX_DPI, autoDpi));

    const predW = probe.width * (autoDpi / PROBE_DPI);
    const predH = probe.height * (autoDpi / PROBE_DPI);
    const predShort = Math.min(predW, predH);

    if (predShort > MIN_SHORT_SIDE_CAP) {
      autoDpi = autoDpi * (MIN_SHORT_SIDE_CAP / predShort);
      autoDpi = Math.max(MIN_DPI, Math.min(MAX_DPI, autoDpi));
    }

    autoDpi = Math.round(autoDpi);

    const probeMb = probeBytes / MB;
    const probeWithinTarget =
      probeMb >= MIN_MB &&
      probeMb <= MAX_MB &&
      Math.min(probe.width, probe.height) <= MIN_SHORT_SIDE_CAP;

    console.log("[findAutoDpi]", {
      probeDpi: PROBE_DPI,
      probeBytes,
      probeW: probe.width,
      probeH: probe.height,
      bytesPerPixel: bytesPerPixel.toFixed(3),
      autoDpi,
      probeWithinTarget,
    });

    if (probeWithinTarget && Math.abs(autoDpi - PROBE_DPI) < 5) {
      return { dpi: PROBE_DPI, probeBlob: probe.blob };
    }
    return { dpi: autoDpi, probeBlob: null };
  } finally {
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
  }
}
