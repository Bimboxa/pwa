import { useState, useEffect } from "react";

// Intrinsic /Rotate of a PDF page (0/90/180/270), null while loading.
// pdf.js applies it by default when getViewport is called without a
// rotation param; viewers that pass an explicit (absolute) rotation need
// this value to compute "intrinsic + user delta".
export default function usePdfPageIntrinsicRotation(pdfDocument, pageNumber) {
  const [rotation, setRotation] = useState(null);

  useEffect(() => {
    setRotation(null);
    if (!pdfDocument) return;

    let cancelled = false;

    pdfDocument
      .getPage(pageNumber)
      .then((page) => {
        if (!cancelled) setRotation(page.rotate ?? 0);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[usePdfPageIntrinsicRotation] getPage error", err);
          setRotation(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber]);

  return rotation;
}
