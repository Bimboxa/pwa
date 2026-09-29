import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { TextLayer } from "pdfjs-dist";

import { triggerRelsBusinessObjectResourceUpdate } from "Features/businessObjects/businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import selectSelectedBusinessObjectId from "Features/businessObjects/utils/selectSelectedBusinessObjectId";

import {
  Box,
  Button,
  GlobalStyles,
  IconButton,
  Paper,
  Typography,
  keyframes,
} from "@mui/material";
import { AddLink, LinkOff } from "@mui/icons-material";

import db from "App/db/db";

import useRelsBusinessObjectResource from "Features/businessObjects/hooks/useRelsBusinessObjectResource";
import linkResourceHighlightToBusinessObjectService from "Features/businessObjects/services/linkResourceHighlightToBusinessObjectService";
import getBusinessObjectCodeLabel from "Features/businessObjects/utils/getBusinessObjectCodeLabel";
import { DEFAULT_BUSINESS_OBJECT_COLOR } from "Features/businessObjects/constants/businessObjectEntityModel";

import getHighlightRectsFromClientRects from "../utils/getHighlightRectsFromClientRects";
import getSelectionClientRects from "../utils/getSelectionClientRects";
import {
  toDisplayedRect,
  toIntrinsicRect,
} from "../utils/rotateNormalizedRect";

const PAGE_PADDING = 8;
const POPUP_WIDTH = 280;
const MAX_TEXT_LENGTH = 1000;
const DRAFT_COLOR = "#ffb300";
const END_OF_CONTENT_CLASS = "endOfContent";
const SELECTING_CLASS = "selecting";

const flash = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.95; }
`;

// pdfjs appends its text-measuring canvases to <body>.
const hiddenCanvasStyles = (
  <GlobalStyles
    styles={{
      ".hiddenCanvasElement": {
        position: "absolute",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        display: "none",
      },
    }}
  />
);

// One page of a PDF "document" resource (resource.isDocument): pdfjs canvas
// fitted to the panel width + selectable text layer + the highlights linked to
// business objects (db.relsBusinessObjectResource). Nothing is rasterized to
// a stored image. Only the highlights of the selected business object are
// shown. Selecting text offers to link it to that object; clicking a
// highlight shows the unlink action.
//
// `rotation` is the ABSOLUTE page rotation (intrinsic + viewer delta);
// highlight rects are stored in the intrinsic frame, hence `rotationDelta`.
export default function ViewerPdfDocumentPage({
  resource,
  pdfDocument,
  pageNumber,
  rotation,
  rotationDelta = 0,
  flashHighlightId,
}) {
  const dispatch = useDispatch();

  const scrollRef = useRef(null);
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);

  // strings

  const linkToS = "Lier à";
  const selectObjectS = "Sélectionnez un ouvrage dans la liste pour le lier.";
  const unlinkS = "Délier";
  const linkedS = "Passage lié à";
  const unlinkedS = "Lien supprimé";
  const deletedObjectS = "Ouvrage supprimé";

  // data

  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const targetBusinessObjectId =
    selectedBusinessObjectId ?? activeBusinessObjectId;

  const targetBusinessObject = useLiveQuery(async () => {
    if (!targetBusinessObjectId) return null;
    const object = await db.businessObjects.get(targetBusinessObjectId);
    return object && !object.deletedAt ? object : null;
  }, [targetBusinessObjectId]);

  const { value: resourceRels } = useRelsBusinessObjectResource({ resource });

  // Only the highlights of the selected business object are shown: a
  // highlight explains ONE object, the others would be noise.
  const pageRels = useMemo(
    () =>
      targetBusinessObjectId
        ? (resourceRels ?? []).filter(
            (r) =>
              r.pageNumber === pageNumber &&
              r.businessObjectId === targetBusinessObjectId
          )
        : [],
    [resourceRels, pageNumber, targetBusinessObjectId]
  );

  const objectIdsKey = [...new Set(pageRels.map((r) => r.businessObjectId))]
    .sort()
    .join(",");
  const businessObjectById = useLiveQuery(async () => {
    const ids = objectIdsKey ? objectIdsKey.split(",") : [];
    const objects = await db.businessObjects.bulkGet(ids);
    const byId = {};
    for (const o of objects) if (o && !o.deletedAt) byId[o.id] = o;
    return byId;
  }, [objectIdsKey]);

  // state

  const [containerWidth, setContainerWidth] = useState(0);
  const [pageDims, setPageDims] = useState(null); // {width, height, scale}
  // text selection not linked yet: {rects (displayed frame), text}
  const [draft, setDraft] = useState(null);
  // clicked highlight(s): {relIds, anchorRect (displayed frame)}
  const [active, setActive] = useState(null);

  // helpers

  const displayedRels = useMemo(
    () =>
      pageRels.map((rel) => ({
        rel,
        rects: (rel.rects ?? []).map((r) => toDisplayedRect(r, rotationDelta)),
      })),
    [pageRels, rotationDelta]
  );

  const activeRels = active
    ? pageRels.filter((r) => active.relIds.includes(r.id))
    : [];

  function getColor(rel) {
    return (
      businessObjectById?.[rel.businessObjectId]?.color ??
      DEFAULT_BUSINESS_OBJECT_COLOR
    );
  }

  function getPopupPosition(anchorRect) {
    if (!pageDims || !anchorRect) return { left: 0, top: 0 };
    const left = Math.max(
      0,
      Math.min(anchorRect.x * pageDims.width, pageDims.width - POPUP_WIDTH)
    );
    const top = (anchorRect.y + anchorRect.height) * pageDims.height + 6;
    return { left, top };
  }

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

  // effects - render the page (canvas + text layer)

  useEffect(() => {
    if (!pdfDocument || rotation == null || containerWidth <= 0) return;

    let cancelled = false;
    let renderTask = null;
    let textLayer = null;

    setDraft(null);
    setActive(null);

    (async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const scale = Math.max(
          0.1,
          (containerWidth - 2 * PAGE_PADDING) / baseViewport.width
        );
        const viewport = page.getViewport({ scale, rotation });
        const dpr = window.devicePixelRatio || 1;

        // Rendered offscreen then copied: pdfjs refuses two concurrent
        // renders on the same canvas, and the visible page never blanks.
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.floor(viewport.width * dpr);
        offscreen.height = Math.floor(viewport.height * dpr);
        renderTask = page.render({
          canvasContext: offscreen.getContext("2d"),
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
        });
        await renderTask.promise;
        if (cancelled) return;

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas || !textLayerDiv) return;

        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
        canvas.getContext("2d").drawImage(offscreen, 0, 0);
        setPageDims({ width: viewport.width, height: viewport.height, scale });

        textLayerDiv.replaceChildren();
        textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();
        if (cancelled) return;

        // "End of content" element of the selection fix (see the
        // selectionchange effect below).
        const endOfContent = document.createElement("div");
        endOfContent.className = END_OF_CONTENT_CLASS;
        textLayerDiv.append(endOfContent);
      } catch (e) {
        if (!cancelled && e?.name !== "RenderingCancelledException") {
          console.error("[ViewerPdfDocumentPage] render error", e);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdfDocument, pageNumber, rotation, containerWidth]);

  // effects - stable text selection
  //
  // The text spans are absolutely positioned: when the cursor hovers an
  // empty area during a drag, the browser extends the selection to the
  // closest node in DOM order, and the selection jumps to unrelated lines.
  // Same fix as the pdf.js viewer (TextLayerBuilder): while selecting, an
  // "end of content" element covers the whole layer and is moved right
  // after the span holding the selection focus, so empty areas resolve to
  // the current position. Not needed on Firefox.

  useEffect(() => {
    const textLayerDiv = textLayerRef.current;
    if (!textLayerDiv) return;

    const isFirefox = navigator.userAgent.includes("Firefox");
    let prevRange = null;

    const getEndDiv = () =>
      textLayerDiv.querySelector(`.${END_OF_CONTENT_CLASS}`);

    const reset = () => {
      const endDiv = getEndDiv();
      if (endDiv) {
        textLayerDiv.append(endDiv);
        endDiv.style.width = "";
        endDiv.style.height = "";
        endDiv.style.userSelect = "";
      }
      textLayerDiv.classList.remove(SELECTING_CLASS);
      prevRange = null;
    };

    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) {
        reset();
        return;
      }
      const range = selection.getRangeAt(0);
      if (!range.intersectsNode(textLayerDiv)) {
        reset();
        return;
      }
      textLayerDiv.classList.add(SELECTING_CLASS);
      if (isFirefox) return;

      const endDiv = getEndDiv();
      if (!endDiv) return;

      // Which end of the selection is being moved?
      const modifyStart =
        prevRange &&
        (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
          range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);
      let anchor = modifyStart ? range.startContainer : range.endContainer;
      if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode;
      if (!modifyStart && range.endOffset === 0) {
        try {
          do {
            while (!anchor.previousSibling) anchor = anchor.parentNode;
            anchor = anchor.previousSibling;
          } while (!anchor.childNodes.length);
        } catch {
          return;
        }
      }

      const parent = anchor?.parentElement;
      if (
        !parent ||
        anchor === endDiv ||
        anchor === textLayerDiv ||
        !textLayerDiv.contains(anchor)
      ) {
        return;
      }
      endDiv.style.width = textLayerDiv.style.width;
      endDiv.style.height = textLayerDiv.style.height;
      endDiv.style.userSelect = "text";
      parent.insertBefore(endDiv, modifyStart ? anchor : anchor.nextSibling);
      prevRange = range.cloneRange();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", reset);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  // effects - scroll to the targeted highlight

  useEffect(() => {
    if (!flashHighlightId || !pageDims) return;
    const target = displayedRels.find((d) => d.rel.id === flashHighlightId);
    const firstRect = target?.rects?.[0];
    if (!firstRect || !scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(
      0,
      firstRect.y * pageDims.height - 80
    );
  }, [flashHighlightId, pageDims, displayedRels]);

  // handlers

  function handleMouseUp(e) {
    const pageEl = pageRef.current;
    const textLayerEl = textLayerRef.current;
    if (!pageEl || !textLayerEl) return;

    const selection = window.getSelection();
    const range =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? selection.getRangeAt(0)
        : null;

    // text selected: draft highlight
    if (range && textLayerEl.contains(range.commonAncestorContainer)) {
      const rects = getHighlightRectsFromClientRects({
        clientRects: getSelectionClientRects(range, textLayerEl),
        containerRect: pageEl.getBoundingClientRect(),
      });
      const text = selection
        .toString()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_TEXT_LENGTH);
      if (rects.length > 0 && text) {
        setActive(null);
        setDraft({ rects, text });
        return;
      }
    }

    // plain click: hit-test the highlights
    setDraft(null);
    const box = pageEl.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    const hits = displayedRels.filter(({ rects }) =>
      rects.some(
        (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
      )
    );
    if (hits.length === 0) {
      setActive(null);
      return;
    }
    const lastRect = hits[0].rects[hits[0].rects.length - 1];
    setActive({ relIds: hits.map((h) => h.rel.id), anchorRect: lastRect });
  }

  async function createLink({ rects, text }) {
    if (!targetBusinessObject) return;
    try {
      await linkResourceHighlightToBusinessObjectService({
        businessObject: targetBusinessObject,
        resource,
        pageNumber,
        rects,
        text,
      });
      dispatch(triggerRelsBusinessObjectResourceUpdate());
      dispatch(
        setToaster({
          message: `${linkedS} "${targetBusinessObject.label ?? ""}"`,
          severity: "success",
        })
      );
    } catch (e) {
      console.error("[ViewerPdfDocumentPage] link", e);
      dispatch(setToaster({ message: e?.message ?? `${e}`, isError: true }));
    }
  }

  async function handleLinkDraft() {
    if (!draft) return;
    await createLink({
      rects: draft.rects.map((r) => toIntrinsicRect(r, rotationDelta)),
      text: draft.text,
    });
    window.getSelection()?.removeAllRanges();
    setDraft(null);
  }

  async function handleUnlink(rel) {
    try {
      await db.relsBusinessObjectResource.delete(rel.id);
      dispatch(triggerRelsBusinessObjectResourceUpdate());
      dispatch(setToaster({ message: unlinkedS, severity: "info" }));
      if (activeRels.length <= 1) setActive(null);
    } catch (e) {
      console.error("[ViewerPdfDocumentPage] unlink", e);
      dispatch(setToaster({ message: e?.message ?? `${e}`, isError: true }));
    }
  }

  function stopEvent(e) {
    e.stopPropagation();
  }

  // Keeps the text selection alive while clicking in a popup.
  function handlePopupMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // render

  const popupSx = {
    position: "absolute",
    zIndex: 3,
    width: POPUP_WIDTH,
    p: 1,
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
  };

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
      {hiddenCanvasStyles}
      <Box
        ref={pageRef}
        onMouseUp={handleMouseUp}
        sx={{
          position: "relative",
          m: `${PAGE_PADDING}px`,
          width: pageDims?.width ?? "auto",
          height: pageDims?.height ?? "auto",
          bgcolor: "white",
          boxShadow: 1,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />

        {/* highlights, under the text layer so the text stays selectable */}
        <Box
          component="svg"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          sx={{
            position: "absolute",
            inset: 0,
            width: 1,
            height: 1,
            zIndex: 1,
            pointerEvents: "none",
            mixBlendMode: "multiply",
          }}
        >
          {displayedRels.map(({ rel, rects }) => {
            const isFlashing = rel.id === flashHighlightId;
            return rects.map((r, index) => (
              <Box
                component="rect"
                key={`${rel.id}-${index}`}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={getColor(rel)}
                sx={{
                  opacity: 0.45,
                  ...(isFlashing && {
                    animation: `${flash} 0.6s ease-in-out 3`,
                  }),
                }}
              />
            ));
          })}
          {draft?.rects.map((r, index) => (
            <rect
              key={`draft-${index}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={DRAFT_COLOR}
              opacity={0.35}
            />
          ))}
        </Box>

        {/* pdfjs text layer (sized by pdfjs from --total-scale-factor) */}
        <Box
          ref={textLayerRef}
          style={{
            "--total-scale-factor": pageDims?.scale ?? 1,
            "--scale-round-x": "1px",
            "--scale-round-y": "1px",
          }}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 2,
            overflow: "clip",
            lineHeight: 1,
            textAlign: "initial",
            textSizeAdjust: "none",
            forcedColorAdjust: "none",
            transformOrigin: "0 0",
            '&[data-main-rotation="90"]': {
              transform: "rotate(90deg) translateY(-100%)",
            },
            '&[data-main-rotation="180"]': {
              transform: "rotate(180deg) translate(-100%, -100%)",
            },
            '&[data-main-rotation="270"]': {
              transform: "rotate(270deg) translateX(-100%)",
            },
            "& span, & br": {
              color: "transparent",
              position: "absolute",
              whiteSpace: "pre",
              cursor: "text",
              transformOrigin: "0% 0%",
            },
            "& ::selection": { background: "rgba(0, 100, 255, 0.25)" },
            "& br::selection": { background: "transparent" },
            // text above the "end of content" element
            "& > span, & > br": { zIndex: 1 },
            [`& .${END_OF_CONTENT_CLASS}`]: {
              display: "block",
              position: "absolute",
              inset: "100% 0 0",
              zIndex: 0,
              cursor: "default",
              userSelect: "none",
            },
            [`&.${SELECTING_CLASS} .${END_OF_CONTENT_CLASS}`]: { top: 0 },
          }}
        />

        {/* draft popup: link the selected text */}
        {draft && (
          <Paper
            elevation={4}
            onMouseDown={handlePopupMouseDown}
            onMouseUp={stopEvent}
            sx={{
              ...popupSx,
              ...getPopupPosition(draft.rects[draft.rects.length - 1]),
            }}
          >
            <Button
              size="small"
              variant="contained"
              startIcon={<AddLink />}
              disabled={!targetBusinessObject}
              onClick={handleLinkDraft}
              sx={{ justifyContent: "flex-start", textTransform: "none" }}
            >
              <Typography variant="body2" noWrap>
                {`${linkToS} ${getBusinessObjectCodeLabel(
                  targetBusinessObject
                )}`}
              </Typography>
            </Button>
            {!targetBusinessObject && (
              <Typography variant="caption" color="text.secondary">
                {selectObjectS}
              </Typography>
            )}
          </Paper>
        )}

        {/* clicked highlight popup: linked object(s) + unlink */}
        {active && activeRels.length > 0 && (
          <Paper
            elevation={4}
            onMouseDown={handlePopupMouseDown}
            onMouseUp={stopEvent}
            sx={{ ...popupSx, ...getPopupPosition(active.anchorRect) }}
          >
            {activeRels.map((rel) => (
              <Box
                key={rel.id}
                sx={{ display: "flex", alignItems: "center", minWidth: 0 }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: 0.5,
                    bgcolor: getColor(rel),
                    flexShrink: 0,
                    mr: 1,
                  }}
                />
                <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                  {getBusinessObjectCodeLabel(
                    businessObjectById?.[rel.businessObjectId]
                  ) || deletedObjectS}
                </Typography>
                <IconButton
                  size="small"
                  title={unlinkS}
                  onClick={() => handleUnlink(rel)}
                >
                  <LinkOff sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
