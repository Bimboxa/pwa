import { useState, useEffect } from "react";

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

// Session cache of fully extracted documents. Keyed by
// `${resource.id}:${resource.fileName}` — re-attaching a file rewrites
// fileName, which invalidates the entry naturally. Only complete extractions
// are cached (a cancelled run is simply redone next time).
const pagesTextCache = new Map();

// Extracts the text of every page of an already-loaded pdfjs document,
// progressively (same cancellation/yield pattern as usePdfThumbnails).
// `enabled` gates the whole extraction so callers can start it lazily on the
// first real search query — visual page-picking never pays this cost.
export default function usePdfPagesText(pdfDocument, { cacheKey, enabled }) {
  const [pagesText, setPagesText] = useState(null); // Array<string|null> | null
  const [progress, setProgress] = useState(null); // {done, total} | null
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pdfDocument || !enabled) {
      setPagesText(null);
      setProgress(null);
      setIsIndexing(false);
      return;
    }

    if (pagesTextCache.has(cacheKey)) {
      setPagesText(pagesTextCache.get(cacheKey));
      setProgress(null);
      setIsIndexing(false);
      return;
    }

    let cancelled = false;

    const extract = async () => {
      try {
        setError(null);
        setIsIndexing(true);

        const numPages = pdfDocument.numPages;
        const texts = new Array(numPages).fill(null);
        setPagesText([...texts]);
        setProgress({ done: 0, total: numPages });

        for (let p = 1; p <= numPages; p++) {
          await yieldToMain();
          if (cancelled) return;

          try {
            const page = await pdfDocument.getPage(p);
            const content = await page.getTextContent();
            texts[p - 1] = content.items
              .map((it) => it.str + (it.hasEOL ? "\n" : ""))
              .join(" ")
              .replace(/\s+/g, " ");
            page.cleanup();
          } catch (pageError) {
            console.error(`[usePdfPagesText] page ${p}`, pageError);
            texts[p - 1] = "";
          }

          if (cancelled) return;
          setPagesText([...texts]);
          setProgress({ done: p, total: numPages });
        }

        pagesTextCache.set(cacheKey, texts);
        if (!cancelled) setIsIndexing(false);
      } catch (err) {
        if (!cancelled) {
          console.error("[usePdfPagesText] extraction error", err);
          setError(err);
          setIsIndexing(false);
        }
      }
    };

    extract();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, enabled, cacheKey]);

  return { pagesText, progress, isIndexing, error };
}
