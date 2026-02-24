import { useState } from "react";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import mergePdfs from "Features/pdf/utils/mergePdfs";
import downloadBlob from "Features/files/utils/downloadBlob";

import getPageDimensions from "../utils/getPageDimensions";

export default function useDownloadPortfolioPdf() {
  const [loading, setLoading] = useState(false);

  async function download({ portfolio, pages }) {
    if (!pages?.length) return;
    setLoading(true);

    try {
      const pagePdfs = [];

      for (const page of pages) {
        const svgEl = document.querySelector(
          `svg[data-portfolio-page-id="${page.id}"]`
        );
        if (!svgEl) continue;

        const dims = getPageDimensions(page.format, page.orientation);

        // capture SVG as PNG blob
        const blob = await getImageFromSvg(svgEl);
        const url = URL.createObjectURL(blob);

        // create single-page PDF with correct page size
        const pdf = await imageToPdfAsync({
          url,
          pageWidth: dims.width,
          pageHeight: dims.height,
        });

        URL.revokeObjectURL(url);
        pagePdfs.push(pdf);
      }

      if (pagePdfs.length === 0) return;

      // merge all pages into single PDF
      const merged = await mergePdfs(pagePdfs, { addPageNumber: true });

      const filename = `${portfolio?.title || "portfolio"}.pdf`;
      downloadBlob(merged, filename);
    } finally {
      setLoading(false);
    }
  }

  return { download, loading };
}
