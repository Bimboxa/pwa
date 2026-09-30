import { useEffect, useRef, useState } from "react";

import { Box } from "@mui/material";

import useRelsBusinessObjectResource from "Features/businessObjects/hooks/useRelsBusinessObjectResource";

import PdfDocumentPageSheet from "./PdfDocumentPageSheet";
import getPdfPageFitScale from "../utils/getPdfPageFitScale";
import { toDisplayedRect } from "../utils/rotateNormalizedRect";

const PAGE_PADDING = 8;
const FLASH_TOP_OFFSET = 80;

// ONE page of a PDF "document" resource (resource.isDocument), for the
// resource detail panel: the page sheet (PdfDocumentPageSheet: selectable
// text + the highlights of the selected business object) fitted to the panel
// WIDTH, in its own vertical scroll. The PDF editor layer shows every page
// in one continuous scroll instead (ViewerPdfPagesScroll).
//
// `rotation` is the ABSOLUTE page rotation (intrinsic + viewer delta);
// highlight rects are stored in the intrinsic frame, hence `rotationDelta`.
//
// `flashNonce` changes each time a passage is targeted: the scroll to
// `flashHighlightId` runs once per (id, nonce), so targeting the same
// passage again re-triggers it and a resize does not re-scroll.
export default function ViewerPdfDocumentPage({
  resource,
  pdfDocument,
  pageNumber,
  rotation,
  rotationDelta = 0,
  flashHighlightId,
  flashNonce = 0,
}) {
  const scrollRef = useRef(null);

  // data

  const { value: resourceRels } = useRelsBusinessObjectResource({ resource });

  // state

  const [containerWidth, setContainerWidth] = useState(0);
  // rendered page: {width, height, scale, pageNumber}
  const [pageDims, setPageDims] = useState(null);

  // effects - fit to width

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setContainerWidth(el.clientWidth)
    );
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // effects - scroll to the targeted highlight, once per (id, nonce) and
  // only when the rendered page is the targeted one (pageDims lags one
  // render behind a page change).

  const flashKey = flashHighlightId
    ? `${flashHighlightId}:${flashNonce}`
    : null;
  const scrolledFlashKeyRef = useRef(null);

  useEffect(() => {
    if (!flashKey || !pageDims || pageDims.pageNumber !== pageNumber) return;
    if (scrolledFlashKeyRef.current === flashKey) return;
    const target = (resourceRels ?? []).find(
      (r) => r.id === flashHighlightId && r.pageNumber === pageNumber
    );
    const firstRect = target?.rects?.[0];
    if (!firstRect || !scrollRef.current) return;
    scrolledFlashKeyRef.current = flashKey;
    scrollRef.current.scrollTop = Math.max(
      0,
      toDisplayedRect(firstRect, rotationDelta).y * pageDims.height -
        FLASH_TOP_OFFSET
    );
  }, [
    flashKey,
    flashHighlightId,
    pageNumber,
    pageDims,
    resourceRels,
    rotationDelta,
  ]);

  // helpers

  function getFitScale(baseViewport) {
    return getPdfPageFitScale({
      containerWidth,
      pageWidth: baseViewport.width,
      pageHeight: baseViewport.height,
      padding: PAGE_PADDING,
    });
  }

  // render

  return (
    <Box
      ref={scrollRef}
      sx={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        overflowX: "hidden",
        bgcolor: "background.default",
      }}
    >
      <PdfDocumentPageSheet
        resource={resource}
        resourceRels={resourceRels}
        pdfDocument={pdfDocument}
        pageNumber={pageNumber}
        rotation={rotation}
        rotationDelta={rotationDelta}
        scale={getFitScale}
        scaleKey={containerWidth > 0 ? containerWidth : null}
        flashHighlightId={flashHighlightId}
        flashNonce={flashNonce}
        onRendered={setPageDims}
        sx={{ m: `${PAGE_PADDING}px` }}
      />
    </Box>
  );
}
