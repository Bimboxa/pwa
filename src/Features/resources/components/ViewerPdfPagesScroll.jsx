import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Box, CircularProgress } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import usePdfPagesBaseSizes from "Features/pdf/hooks/usePdfPagesBaseSizes";

import PdfDocumentPageSheet from "./PdfDocumentPageSheet";
import getPdfPageFitScale from "../utils/getPdfPageFitScale";
import {
  getPdfPagesScrollLayout,
  getPdfPagesVisibleRange,
  getPdfMostVisiblePageIndex,
  getPdfScrollAnchor,
  getPdfScrollForAnchor,
} from "../utils/pdfPagesScrollLayout";
import { toDisplayedRect } from "../utils/rotateNormalizedRect";

const PAGE_PADDING = 8;
const PAGE_GAP = 12;
// A zoom shows at once (stretched canvases) and sharpens after this delay.
const RENDER_DELAY_MS = 150;
// Wheel zoom (Ctrl / Cmd + wheel, trackpad pinch): per-event delta clamp and
// sensitivity — a mouse notch ≈ ×1.28, a pinch step a few %.
const WHEEL_DELTA_CLAMP = 50;
const WHEEL_ZOOM_SENSITIVITY = 0.005;
// Blank placeholders are only drawn this many pages around the mounted
// sheets (a long document must not cost thousands of nodes per render).
const PLACEHOLDER_PAGES = 20;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Continuous PDF viewer: every page of the document stacked in ONE scroll
// area — the pages really scroll, no jump from page to page. Used by the PDF
// editor layer.
//
// - Layout: the page sizes are read up front (usePdfPagesBaseSizes), so the
//   whole stack has its final height before any page renders; only the
//   sheets near the viewport are mounted (PdfDocumentPageSheet), the others
//   are blank placeholders.
// - Scale: `zoom` 1 = the largest page fits the area entirely.
// - `pageNumber` is two-way: scrolling reports the page showing the most
//   (`onPageNumberChange`), and a page number set from outside (thumbnail,
//   arrows, search result, navigation target) scrolls to the top of that
//   page.
// - Zoom: `onZoomChange` from Ctrl / Cmd + wheel and trackpad pinch, around
//   the pointer; any layout change (zoom buttons, rotation, resize) keeps
//   the point at the center of the viewport still.
// - `flashHighlightId` + `flashNonce`: scrolls to that passage once per
//   (id, nonce) and flashes it.
//
// `interactive: false` (plan PDFs): pages are plain images, no text layer
// nor highlights.
export default function ViewerPdfPagesScroll({
  resource,
  resourceRels,
  pdfDocument,
  pageNumber,
  onPageNumberChange,
  rotationDelta = 0,
  zoom = 1,
  minZoom = 0.5,
  maxZoom = 4,
  onZoomChange,
  interactive = true,
  showAllBusinessObjects = false,
  hideHighlights = false,
  flashHighlightId,
  flashNonce = 0,
  onHighlightClick,
}) {
  const scrollRef = useRef(null);

  // data

  const baseSizes = usePdfPagesBaseSizes(pdfDocument);

  // state

  // scroll area: client width (stable scrollbar gutter) x outer height
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  // mounted sheets
  const [range, setRange] = useState({ first: 0, last: -1 });

  // helpers - layout

  const sizes = useMemo(() => {
    if (!baseSizes) return null;
    const isQuarterTurn = Math.abs(rotationDelta % 180) === 90;
    return isQuarterTurn
      ? baseSizes.map((s) => ({ width: s.height, height: s.width }))
      : baseSizes;
  }, [baseSizes, rotationDelta]);

  const layout = useMemo(() => {
    if (!sizes?.length || viewport.width <= 0 || viewport.height <= 0)
      return null;
    let pageWidth = 0;
    let pageHeight = 0;
    for (const size of sizes) {
      pageWidth = Math.max(pageWidth, size.width);
      pageHeight = Math.max(pageHeight, size.height);
    }
    const fitScale = getPdfPageFitScale({
      fitMode: "page",
      containerWidth: viewport.width,
      // 2 px of slack: no sub-pixel overflow at zoom 1
      containerHeight: viewport.height - 2,
      pageWidth,
      pageHeight,
      padding: PAGE_PADDING,
    });
    return getPdfPagesScrollLayout({
      sizes,
      scale: fitScale * zoom,
      gap: PAGE_GAP,
      padding: PAGE_PADDING,
    });
  }, [sizes, viewport.width, viewport.height, zoom]);

  // refs read by the scroll / wheel handlers

  const layoutRef = useRef(null);
  const anchorRef = useRef(null);
  const pageNumberRef = useRef(pageNumber);
  pageNumberRef.current = pageNumber;
  // page number the scroll position already reflects (set by a scroll
  // report or by a programmatic jump): anything else is an external change
  const syncedPageRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onPageNumberChangeRef = useRef(onPageNumberChange);
  onPageNumberChangeRef.current = onPageNumberChange;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Reads the scroll position: mounted range, center anchor, current page
  // (`reportPage: false` while the scroll position is not meaningful yet).
  const updateFromScroll = useCallback(({ reportPage = true } = {}) => {
    const el = scrollRef.current;
    const currentLayout = layoutRef.current;
    if (!el || !currentLayout) return;

    const scrollTop = el.scrollTop;
    const viewportHeight = el.clientHeight;

    const next = getPdfPagesVisibleRange(currentLayout, {
      scrollTop,
      viewportHeight,
      overscan: viewportHeight,
    });
    setRange((prev) =>
      prev.first === next.first && prev.last === next.last ? prev : next
    );

    anchorRef.current = getPdfScrollAnchor(currentLayout, {
      scrollTop,
      scrollLeft: el.scrollLeft,
      viewportWidth: el.clientWidth,
      viewportX: el.clientWidth / 2,
      viewportY: viewportHeight / 2,
    });

    if (!reportPage) return;
    const index = getPdfMostVisiblePageIndex(currentLayout, {
      scrollTop,
      viewportHeight,
      currentIndex: pageNumberRef.current - 1,
    });
    if (index >= 0 && index + 1 !== pageNumberRef.current) {
      pageNumberRef.current = index + 1;
      syncedPageRef.current = index + 1;
      onPageNumberChangeRef.current?.(index + 1);
    }
  }, []);

  // effects - scroll area size

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = el.offsetHeight;
      setViewport((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  // effects - layout change (zoom, rotation, resize): keep the anchored
  // point still. The anchor was taken in the PREVIOUS layout, which is why
  // layoutRef only moves on here.

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const previousLayout = layoutRef.current;
    layoutRef.current = layout;
    if (!el || !layout) return;

    if (previousLayout && anchorRef.current) {
      const next = getPdfScrollForAnchor(layout, anchorRef.current, {
        viewportWidth: el.clientWidth,
      });
      if (next) {
        el.scrollTop = next.scrollTop;
        el.scrollLeft = next.scrollLeft;
      }
    }
    // First layout: the scroll is still at the top, the jump to the opening
    // page comes next — page 1 must not be reported in between.
    updateFromScroll({ reportPage: syncedPageRef.current != null });
  }, [layout, updateFromScroll]);

  // effects - page number set from outside: jump to the top of the page
  // (declared after the layout effect: it needs layoutRef up to date)

  const isLayoutReady = Boolean(layout);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const currentLayout = layoutRef.current;
    if (!el || !currentLayout) return;
    if (syncedPageRef.current === pageNumber) return;
    syncedPageRef.current = pageNumber;

    const index = clamp(pageNumber - 1, 0, currentLayout.offsets.length - 1);
    el.scrollTop = Math.max(0, currentLayout.offsets[index] - PAGE_PADDING);
    updateFromScroll();
  }, [pageNumber, isLayoutReady, updateFromScroll]);

  // effects - targeted passage: scroll to it once per (id, nonce). Declared
  // after the page jump so the passage wins over the top of its page.

  const flashKey = flashHighlightId
    ? `${flashHighlightId}:${flashNonce}`
    : null;
  const scrolledFlashKeyRef = useRef(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const currentLayout = layoutRef.current;
    if (!flashKey || !el || !currentLayout) return;
    if (scrolledFlashKeyRef.current === flashKey) return;

    // the rows may still be loading: retried when they arrive
    const rel = (resourceRels ?? []).find((r) => r.id === flashHighlightId);
    const firstRect = rel?.rects?.[0];
    const index = (rel?.pageNumber ?? 0) - 1;
    if (!firstRect || index < 0 || index >= currentLayout.offsets.length)
      return;

    scrolledFlashKeyRef.current = flashKey;
    const rectTop =
      currentLayout.offsets[index] +
      toDisplayedRect(firstRect, rotationDelta).y *
        currentLayout.heights[index];
    el.scrollTop = Math.max(0, rectTop - Math.min(el.clientHeight / 4, 160));
    updateFromScroll();
  }, [
    flashKey,
    flashHighlightId,
    isLayoutReady,
    resourceRels,
    rotationDelta,
    updateFromScroll,
  ]);

  // effects - the scroll area takes the keyboard (arrows, Page Up / Down,
  // Space, Home / End scroll natively)

  useEffect(() => {
    if (isLayoutReady) scrollRef.current?.focus({ preventScroll: true });
  }, [isLayoutReady]);

  // effects - wheel zoom around the pointer. Native listener: React's wheel
  // listeners are passive, and the browser page zoom must be prevented.

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const currentLayout = layoutRef.current;
      if (!currentLayout || !onZoomChangeRef.current) return;

      const delta = clamp(e.deltaY, -WHEEL_DELTA_CLAMP, WHEEL_DELTA_CLAMP);
      const nextZoom = clamp(
        zoomRef.current * Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY),
        minZoom,
        maxZoom
      );
      if (nextZoom === zoomRef.current) return;

      const rect = el.getBoundingClientRect();
      anchorRef.current = getPdfScrollAnchor(currentLayout, {
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        viewportWidth: el.clientWidth,
        viewportX: e.clientX - rect.left,
        viewportY: e.clientY - rect.top,
      });
      // several wheel events may land before the next render
      zoomRef.current = nextZoom;
      onZoomChangeRef.current(nextZoom);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [minZoom, maxZoom]);

  // handlers

  const scrollFrameRef = useRef(null);

  function handleScroll() {
    if (scrollFrameRef.current != null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      updateFromScroll();
    });
  }

  useEffect(
    () => () => {
      if (scrollFrameRef.current != null)
        cancelAnimationFrame(scrollFrameRef.current);
    },
    []
  );

  // render

  const pagesCount = layout?.offsets.length ?? 0;
  const windowFirst = Math.max(0, range.first - PLACEHOLDER_PAGES);
  const windowLast = Math.min(pagesCount - 1, range.last + PLACEHOLDER_PAGES);
  const windowIndexes = [];
  for (let index = windowFirst; index <= windowLast; index++)
    windowIndexes.push(index);

  return (
    <Box
      ref={scrollRef}
      tabIndex={-1}
      onScroll={handleScroll}
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "auto",
        // the fit must not depend on the vertical scrollbar showing up
        scrollbarGutter: "stable",
        bgcolor: "background.default",
        outline: "none",
      }}
    >
      {!layout ? (
        <BoxCenter>
          <CircularProgress />
        </BoxCenter>
      ) : (
        <Box
          sx={{
            position: "relative",
            width: 1,
            minWidth: layout.contentWidth,
            height: layout.totalHeight,
          }}
        >
          {windowIndexes.map((index) => {
            const top = layout.offsets[index];
            const width = layout.widths[index];
            const height = layout.heights[index];
            const positionSx = {
              position: "absolute",
              top,
              left: "50%",
              ml: `${-width / 2}px`,
            };
            const isMounted = index >= range.first && index <= range.last;

            if (!isMounted) {
              return (
                <Box
                  key={index}
                  sx={{
                    ...positionSx,
                    width,
                    height,
                    bgcolor: "white",
                    boxShadow: 1,
                  }}
                />
              );
            }

            return (
              <PdfDocumentPageSheet
                key={index}
                resource={resource}
                resourceRels={resourceRels}
                pdfDocument={pdfDocument}
                pageNumber={index + 1}
                rotation={
                  (((baseSizes[index].rotation + rotationDelta) % 360) + 360) %
                  360
                }
                rotationDelta={rotationDelta}
                scale={layout.scale}
                boxSize={{ width, height }}
                renderDelayMs={RENDER_DELAY_MS}
                interactive={interactive}
                showAllBusinessObjects={showAllBusinessObjects}
                hideHighlights={hideHighlights}
                flashHighlightId={flashHighlightId}
                flashNonce={flashNonce}
                onHighlightClick={onHighlightClick}
                sx={positionSx}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}
