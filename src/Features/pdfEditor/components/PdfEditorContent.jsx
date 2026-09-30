import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  closePdfEditor,
  setPdfEditorPassagesPopperOpen,
  setPdfEditorResourceId,
  setPdfEditorShowHighlights,
  setPdfEditorTargetPage,
} from "../pdfEditorSlice";

import {
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
} from "@mui/material";

import db from "App/db/db";

import BoxCenter from "Features/layout/components/BoxCenter";
import SearchBar from "Features/search/components/SearchBar";
import ContainerFilesSelectorV2 from "Features/files/components/ContainerFilesSelectorV2";
import ListPdfSearchResults from "Features/detailFolio/components/ListPdfSearchResults";
import ListPdfPages from "Features/resources/components/ListPdfPages";
import ViewerPdfPagesScroll from "Features/resources/components/ViewerPdfPagesScroll";
import useResources from "Features/resources/hooks/useResources";
import useResourceFile from "Features/resources/hooks/useResourceFile";
import useResourceIsDocument from "Features/resources/hooks/useResourceIsDocument";
import useReattachResourceFile from "Features/resources/hooks/useReattachResourceFile";
import usePdfPagesViewerState from "Features/resources/hooks/usePdfPagesViewerState";
import useRelsBusinessObjectResource from "Features/businessObjects/hooks/useRelsBusinessObjectResource";

import ToolbarPdfEditor from "./ToolbarPdfEditor";
import PopperPdfPassages from "./PopperPdfPassages";
import useSelectBusinessObjectFromPdfEditor from "../hooks/useSelectBusinessObjectFromPdfEditor";
import groupPdfPassagesByPage from "../utils/groupPdfPassagesByPage";
import isEditableTarget from "Features/baseMapsGrid/utils/isEditableTarget";

const SIDEBAR_WIDTH = 200;
const THUMBNAILS_WIDTH = 150;
// zoom 1 = the whole page fits the viewing area
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
// stops of the − / + buttons (the wheel zooms continuously)
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const ZOOM_EPSILON = 0.01;
// Right-panel tools with their own (large / resizable / condensed) width:
// they simply cover the layer. The fixed-width ones (Propriétés…) get a
// matching inset so the page stays readable beside them.
const NO_INSET_TOOL_KEYS = ["ELEVATION", "RESOURCES", "CAPTURE"];

// Content of the PDF editor layer for ONE resource — keyed by resource id in
// LayerPdfEditor, so the page, the rotation, the zoom and the search start
// fresh with each document. Same viewer state and page sheets as the
// RESOURCES panel (usePdfPagesViewerState, PdfDocumentPageSheet), laid out
// for the editors area: header, pages sidebar (search + thumbnails) and the
// pages in one continuous scroll (ViewerPdfPagesScroll) — zoomable with the
// header buttons, Ctrl / Cmd + wheel and the trackpad pinch.
export default function PdfEditorContent({ resource }) {
  const dispatch = useDispatch();

  // strings

  const loadingPdfS = "Chargement du PDF...";
  const searchS = "Rechercher...";
  const indexingS = "Indexation";
  const pagesS = "pages";
  const noResultS = "Aucun résultat";
  const missingS =
    "Le fichier n'est pas disponible sur cet appareil (il n'est pas embarqué dans l'enregistrement du scope).";
  const reattachS = "Recharger le fichier en local";

  // data

  const { file, loading, fileIsMissing } = useResourceFile(resource);
  const { isDocument } = useResourceIsDocument(resource, file);
  const reattachResourceFile = useReattachResourceFile();
  const resources = useResources();
  const selectBusinessObject = useSelectBusinessObjectFromPdfEditor();

  const targetPdfPage = useSelector((s) => s.pdfEditor.targetPdfPage);
  const showHighlights = useSelector((s) => s.pdfEditor.showHighlights);
  const passagesPopperOpen = useSelector((s) => s.pdfEditor.passagesPopperOpen);
  const rightPanelKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const rightPanelWidth = useSelector((s) => s.rightPanel.width);

  const {
    pdfDocument,
    pdfError,
    progress,
    numPages,
    pageNumber,
    setPageNumber,
    goToPage,
    rotationDelta,
    rotate,
    thumbnails,
    flashHighlightId,
    flashNonce,
    searchText,
    setSearchText,
    searchEnabled,
    results,
    isIndexing,
    indexProgress,
  } = usePdfPagesViewerState({
    resource,
    file,
    isDocument,
    // every page is rendered by the continuous viewer
    withPageImage: false,
    targetPdfPage,
    onTargetConsumed: () => dispatch(setPdfEditorTargetPage(null)),
  });

  // Highlighted passages of the document ("sommaire") and their objects.
  const { value: rels } = useRelsBusinessObjectResource({ resource });
  const passageGroups = useMemo(() => groupPdfPassagesByPage(rels), [rels]);
  const passagesCount = passageGroups.reduce(
    (sum, g) => sum + g.rels.length,
    0
  );
  const objectIdsKey = [
    ...new Set(
      passageGroups.flatMap((g) => g.rels.map((r) => r.businessObjectId))
    ),
  ]
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

  const [zoom, setZoom] = useState(1);
  const [reattaching, setReattaching] = useState(false);
  const [passagesAnchorEl, setPassagesAnchorEl] = useState(null);

  // helpers

  const pdfResources = useMemo(
    () =>
      resources
        .filter((r) => r.fileType === "PDF")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [resources]
  );

  const zoomOutStep = [...ZOOM_STEPS]
    .reverse()
    .find((step) => step < zoom - ZOOM_EPSILON);
  const zoomInStep = ZOOM_STEPS.find((step) => step > zoom + ZOOM_EPSILON);
  const rightInset =
    rightPanelKey && !NO_INSET_TOOL_KEYS.includes(rightPanelKey)
      ? rightPanelWidth
      : 0;

  // effects - keep the selected thumbnail in view

  const sidebarRef = useRef(null);
  useEffect(() => {
    const el = sidebarRef.current?.querySelector(".Mui-selected");
    el?.scrollIntoView({ block: "nearest" });
  }, [pageNumber]);

  // effects - ← / → turn the pages

  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;
  const pageNumberRef = useRef(pageNumber);
  pageNumberRef.current = pageNumber;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isEditableTarget(e.target)) return;
      if (e.target?.closest?.(".MuiModal-root, .MuiPopover-root")) return;
      goToPageRef.current(
        pageNumberRef.current + (e.key === "ArrowRight" ? 1 : -1)
      );
      e.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // handlers

  function handleClose() {
    dispatch(closePdfEditor());
  }

  function handleResourceChange(resourceId) {
    dispatch(setPdfEditorResourceId(resourceId));
  }

  function handleToggleHighlights() {
    dispatch(setPdfEditorShowHighlights(!showHighlights));
  }

  function handleTogglePassagesPopper() {
    dispatch(setPdfEditorPassagesPopperOpen(!passagesPopperOpen));
  }

  // Through the one-shot target: same path as a document link, so a repeat
  // click on the same passage scrolls and flashes again.
  function handlePassageClick(rel) {
    dispatch(setPdfEditorShowHighlights(true));
    dispatch(
      setPdfEditorTargetPage({
        pageNumber: rel.pageNumber,
        highlightId: rel.id,
      })
    );
  }

  function handleHighlightClick(clickedRels) {
    selectBusinessObject(clickedRels?.[0]?.businessObjectId);
  }

  async function handleReattach(files) {
    const pickedFile = files?.[0];
    if (!pickedFile) return;
    setReattaching(true);
    try {
      await reattachResourceFile(resource, pickedFile);
    } finally {
      setReattaching(false);
    }
  }

  // render - body

  let body;
  if (loading) {
    body = (
      <BoxCenter>
        <CircularProgress />
      </BoxCenter>
    );
  } else if (fileIsMissing) {
    body = (
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          p: 2,
          maxWidth: 560,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {missingS}
        </Typography>
        <Box sx={{ flexGrow: 1, minHeight: 0, maxHeight: 240 }}>
          <ContainerFilesSelectorV2
            callToActionLabel={reattachS}
            onFilesChange={handleReattach}
            loading={reattaching}
          />
        </Box>
      </Box>
    );
  } else if (!pdfDocument) {
    body = (
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          maxWidth: 560,
        }}
      >
        {pdfError ? (
          <Alert severity="error">{pdfError.message ?? `${pdfError}`}</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              {loadingPdfS}
            </Typography>
            <LinearProgress
              variant={progress?.total ? "determinate" : "indeterminate"}
              value={
                progress?.total
                  ? Math.min(100, (progress.loaded / progress.total) * 100)
                  : 0
              }
            />
          </>
        )}
      </Box>
    );
  } else {
    body = (
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        {/* pages sidebar: search, then the results or the thumbnails */}
        <Box
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            bgcolor: "background.paper",
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              p: 0.5,
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <SearchBar
              value={searchText}
              onChange={setSearchText}
              placeholder={searchS}
              fullWidth
            />
          </Box>

          <Box
            ref={sidebarRef}
            sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto" }}
          >
            {searchEnabled ? (
              <>
                {isIndexing && (
                  <Box sx={{ px: 1, py: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={
                        indexProgress?.total
                          ? (indexProgress.done / indexProgress.total) * 100
                          : 0
                      }
                    />
                    <Typography variant="caption" color="text.secondary">
                      {`${indexingS} ${indexProgress?.done ?? 0}/${
                        indexProgress?.total ?? 0
                      } ${pagesS}...`}
                    </Typography>
                  </Box>
                )}
                {results.length === 0 && !isIndexing ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ p: 2 }}
                  >
                    {noResultS}
                  </Typography>
                ) : (
                  <ListPdfSearchResults
                    results={results}
                    selectedPageNumber={pageNumber}
                    onResultClick={setPageNumber}
                  />
                )}
              </>
            ) : (
              <Box sx={{ width: THUMBNAILS_WIDTH, mx: "auto" }}>
                <ListPdfPages
                  pageNumber={pageNumber}
                  thumbnails={thumbnails}
                  onPageNumberChange={setPageNumber}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* page */}
        <Box
          sx={{
            position: "relative",
            flexGrow: 1,
            minWidth: 0,
            minHeight: 0,
            bgcolor: "background.default",
          }}
        >
          <ViewerPdfPagesScroll
            resource={resource}
            resourceRels={rels}
            pdfDocument={pdfDocument}
            pageNumber={pageNumber}
            onPageNumberChange={setPageNumber}
            rotationDelta={rotationDelta}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onZoomChange={setZoom}
            // plan PDFs: plain pages, no text layer nor highlights
            interactive={isDocument}
            showAllBusinessObjects
            hideHighlights={!showHighlights}
            flashHighlightId={flashHighlightId}
            flashNonce={flashNonce}
            onHighlightClick={handleHighlightClick}
          />
        </Box>
      </Box>
    );
  }

  // render

  return (
    <Box
      sx={{
        position: "relative",
        flexGrow: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        pr: `${rightInset}px`,
        transition: "padding-right 0.2s ease",
      }}
    >
      <ToolbarPdfEditor
        resource={resource}
        pdfResources={pdfResources}
        onResourceChange={handleResourceChange}
        pageNumber={pageNumber}
        numPages={numPages}
        onPageChange={goToPage}
        onRotate={rotate}
        zoom={zoom}
        canZoomOut={zoomOutStep != null}
        canZoomIn={zoomInStep != null}
        onZoomOut={() => zoomOutStep != null && setZoom(zoomOutStep)}
        onZoomIn={() => zoomInStep != null && setZoom(zoomInStep)}
        onZoomReset={() => setZoom(1)}
        showPassages={isDocument}
        showHighlights={showHighlights}
        onToggleHighlights={handleToggleHighlights}
        passagesCount={passagesCount}
        passagesPopperOpen={passagesPopperOpen}
        onTogglePassagesPopper={handleTogglePassagesPopper}
        onPassagesAnchor={setPassagesAnchorEl}
        onClose={handleClose}
      />

      {body}

      <PopperPdfPassages
        open={passagesPopperOpen && isDocument}
        anchorEl={passagesAnchorEl}
        groups={passageGroups}
        businessObjectById={businessObjectById}
        pageNumber={pageNumber}
        onPassageClick={handlePassageClick}
      />
    </Box>
  );
}
