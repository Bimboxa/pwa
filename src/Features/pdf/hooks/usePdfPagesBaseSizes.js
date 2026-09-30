import { useEffect, useState } from "react";

const FALLBACK_SIZE = { width: 595, height: 842, rotation: 0 }; // A4, pt
const YIELD_EVERY = 50;

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

// Size of every page of a loaded pdfjs document at scale 1, in its INTRINSIC
// rotation: [{width, height, rotation}] (rotation = the page /Rotate), null
// while loading. A continuous viewer needs them all up front to lay the
// pages out before rendering any (only the page dictionaries are read: no
// rendering, fast even on long documents).
export default function usePdfPagesBaseSizes(pdfDocument) {
  const [sizes, setSizes] = useState(null);

  useEffect(() => {
    setSizes(null);
    if (!pdfDocument) return;

    let cancelled = false;

    (async () => {
      const result = [];
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        try {
          const page = await pdfDocument.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1 });
          result.push({
            width: viewport.width,
            height: viewport.height,
            rotation: page.rotate ?? 0,
          });
        } catch (e) {
          if (cancelled) return;
          console.error("[usePdfPagesBaseSizes] getPage error", i, e);
          result.push(result[result.length - 1] ?? FALLBACK_SIZE);
        }
        if (i % YIELD_EVERY === 0) {
          await yieldToMain();
          if (cancelled) return;
        }
      }
      setSizes(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

  return sizes;
}
