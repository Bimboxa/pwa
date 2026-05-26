import { useState, useEffect } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Single source of truth for the parsed PDF inside the baseMap creator dialog.
// Parsing a heavy vector blueprint can take several seconds; sharing the doc
// avoids re-parsing for thumbnails, page preview, and final render.
//
// Cancellation: we keep a handle on the in-flight loadingTask so a unmount
// (or StrictMode double-mount in dev) can destroy() it cleanly — otherwise
// revoking the blob URL mid-stream crashes pdfjs with ERR_FILE_NOT_FOUND.
export default function usePdfDocument(pdfFile) {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { loaded, total } | null

  useEffect(() => {
    if (!pdfFile) {
      setPdfDocument(null);
      setError(null);
      setProgress(null);
      return;
    }

    let cancelled = false;
    let loadingTask = null;
    let loadedDoc = null;

    setError(null);
    setPdfDocument(null);
    setProgress(null);

    (async () => {
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        if (cancelled) return;

        loadingTask = getDocument({ data: arrayBuffer });
        loadingTask.onProgress = (p) => {
          if (!cancelled) setProgress(p);
        };

        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy().catch(() => {});
          return;
        }
        loadedDoc = doc;
        setPdfDocument(doc);
      } catch (err) {
        if (!cancelled) {
          console.error("[usePdfDocument] load error", err);
          setError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (loadingTask) loadingTask.destroy().catch(() => {});
      if (loadedDoc) loadedDoc.destroy().catch(() => {});
    };
  }, [pdfFile]);

  return { pdfDocument, error, progress };
}
