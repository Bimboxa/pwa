import { useEffect, useMemo, useRef, useState } from "react";

import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfThumbnails from "Features/pdf/hooks/usePdfThumbnails";
import usePdfPageIntrinsicRotation from "Features/pdf/hooks/usePdfPageIntrinsicRotation";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";
import usePdfPagesText from "Features/detailFolio/hooks/usePdfPagesText";
import searchPdfPages from "Features/detailFolio/utils/searchPdfPages";

const MIN_SEARCH_LENGTH = 2;

// State of a page-based PDF viewer, shared by the resource detail panel
// (ViewerPdfPages) and the PDF editor layer (PdfEditorContent): the parsed
// document, the viewed page, the rotation, the page thumbnails, the text
// search and the navigation target.
//
// Rotation model: the ±90° buttons hold a DELTA on top of each page's
// intrinsic /Rotate; `effectiveRotation` is the ABSOLUTE rotation (intrinsic
// + delta), matching the app-wide folio.rotation convention.
//
// `targetPdfPage` is a ONE-SHOT target {pageNumber, rotation?, highlightId?}
// owned by the caller (redux): applied, then `onTargetConsumed` clears it so
// a later click on the same page / passage re-triggers the navigation even
// if the viewer stayed mounted. The target rotation is absolute → converted
// to a delta. `flashNonce` changes at every consumed target: the page
// viewer keys its scroll + flash on it.
//
// `isDocument` (text document, not a plan): the page is rendered by
// ViewerPdfDocumentPage, no page image is generated. `withPageImage: false`
// (continuous viewer, which renders every page itself): never generated.
export default function usePdfPagesViewerState({
  resource,
  file,
  isDocument,
  withPageImage = true,
  targetPdfPage,
  onTargetConsumed,
}) {
  // data

  const { pdfDocument, error: pdfError, progress } = usePdfDocument(file);
  const numPages = pdfDocument?.numPages ?? 0;

  // state

  const [pageNumber, setPageNumber] = useState(1);
  const [rotationDelta, setRotationDelta] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [flashHighlightId, setFlashHighlightId] = useState(null);
  const [flashNonce, setFlashNonce] = useState(0);

  // effects - one-shot navigation target

  const onTargetConsumedRef = useRef(onTargetConsumed);
  onTargetConsumedRef.current = onTargetConsumed;

  useEffect(() => {
    if (!targetPdfPage || !pdfDocument) return;
    const targetPageNumber = Math.min(
      Math.max(1, targetPdfPage.pageNumber ?? 1),
      pdfDocument.numPages || 1
    );
    setPageNumber(targetPageNumber);
    setFlashHighlightId(targetPdfPage.highlightId ?? null);
    setFlashNonce((n) => n + 1);
    if (typeof targetPdfPage.rotation === "number") {
      pdfDocument
        .getPage(targetPageNumber)
        .then((page) => {
          const delta = targetPdfPage.rotation - (page.rotate ?? 0);
          setRotationDelta(((delta % 360) + 360) % 360);
        })
        .catch(() => {});
    }
    onTargetConsumedRef.current?.();
  }, [targetPdfPage, pdfDocument]);

  // data - page

  const { thumbnails } = usePdfThumbnails(pdfDocument, pageNumber);
  const intrinsicRotation = usePdfPageIntrinsicRotation(
    pdfDocument,
    pageNumber
  );
  const effectiveRotation =
    intrinsicRotation == null
      ? null
      : (((intrinsicRotation + rotationDelta) % 360) + 360) % 360;
  const { imageUrl } = usePdfPageImageUrl(
    isDocument || !withPageImage ? null : pdfDocument,
    pageNumber,
    effectiveRotation
  );

  // data - search
  //
  // Lazy text search: pages are indexed only once a real query is typed,
  // with a module-level cache keyed by resource (same as the folio dialog).

  const searchEnabled = searchText.trim().length >= MIN_SEARCH_LENGTH;
  const {
    pagesText,
    progress: indexProgress,
    isIndexing,
  } = usePdfPagesText(pdfDocument, {
    cacheKey: `${resource?.id}:${resource?.fileName}`,
    enabled: searchEnabled,
  });

  const results = useMemo(
    () => searchPdfPages(pagesText, searchText),
    [pagesText, searchText]
  );

  // handlers

  function rotate(deltaDeg) {
    setRotationDelta((r) => (((r + deltaDeg) % 360) + 360) % 360);
  }

  function goToPage(next) {
    if (!numPages) return;
    setPageNumber(Math.min(Math.max(1, next), numPages));
  }

  return {
    pdfDocument,
    pdfError,
    progress,
    numPages,
    pageNumber,
    setPageNumber,
    goToPage,
    rotationDelta,
    rotate,
    effectiveRotation,
    thumbnails,
    imageUrl,
    flashHighlightId,
    flashNonce,
    searchText,
    setSearchText,
    searchEnabled,
    results,
    isIndexing,
    indexProgress,
  };
}
