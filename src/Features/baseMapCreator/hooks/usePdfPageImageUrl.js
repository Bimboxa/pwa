import { useState, useEffect } from "react";

import { renderPageToPngBlob } from "Features/pdf/utils/pdfToPngAsync";

const LOW_DPI = 36;
const STANDARD_DPI = 72;

// Yield to the browser so the previous setImageUrl actually paints before
// we start the next (CPU-heavy) render pass.
const yieldToPaint = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );

export default function usePdfPageImageUrl(pdfDocument, pageNumber, rotate) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (!pdfDocument) {
      setImageUrl(null);
      setIsUpgrading(false);
      return;
    }

    let cancelled = false;
    let currentUrl = null;

    const swapUrl = (newUrl) => {
      if (cancelled) {
        URL.revokeObjectURL(newUrl);
        return;
      }
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = newUrl;
      setImageUrl(newUrl);
    };

    const run = async () => {
      setIsUpgrading(true);
      try {
        const pdfPage = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const low = await renderPageToPngBlob({
          pdfPage,
          resolution: LOW_DPI,
          rotate,
        });
        if (cancelled) return;
        swapUrl(URL.createObjectURL(low.blob));

        // Let the low-res image actually paint before we start the heavier
        // standard render — otherwise the user sees a single late swap.
        await yieldToPaint();
        if (cancelled) return;

        const std = await renderPageToPngBlob({
          pdfPage,
          resolution: STANDARD_DPI,
          rotate,
        });
        if (cancelled) return;
        swapUrl(URL.createObjectURL(std.blob));
      } catch (err) {
        if (!cancelled) console.error("[usePdfPageImageUrl] render error", err);
      } finally {
        if (!cancelled) setIsUpgrading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setImageUrl(null);
      setIsUpgrading(false);
    };
  }, [pdfDocument, pageNumber, rotate]);

  return { imageUrl, isUpgrading };
}
