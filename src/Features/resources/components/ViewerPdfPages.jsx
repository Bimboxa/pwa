import { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setTargetPdfPage } from "../resourcesSlice";

import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfThumbnails from "Features/pdf/hooks/usePdfThumbnails";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";
import usePdfPagesText from "Features/detailFolio/hooks/usePdfPagesText";
import searchPdfPages from "Features/detailFolio/utils/searchPdfPages";
import ListPdfSearchResults from "Features/detailFolio/components/ListPdfSearchResults";

import ListDraggablePdfPages from "./ListDraggablePdfPages";

const MIN_SEARCH_LENGTH = 2;

// Page-based PDF viewer for the resource detail panel: left column of page
// thumbnails (each one selectable AND draggable towards the 2D editor to
// create a DETAIL annotation with folio = the page), main area previewing
// the selected page with a ±90° rotation control (the rotation is carried
// into the folio of a dropped page, like the manual folio dialog).
export default function ViewerPdfPages({ resource, file }) {
  const dispatch = useDispatch();

  // strings

  const loadingPdfS = "Chargement du PDF...";
  const pageS = "Page";
  const rotateCcwS = "Pivoter à gauche";
  const rotateCwS = "Pivoter à droite";
  const searchS = "Rechercher dans le PDF...";
  const indexingS = "Indexation";
  const pagesS = "pages";
  const noResultS = "Aucun résultat";

  // data

  const { pdfDocument, error: pdfError, progress } = usePdfDocument(file);
  const numPages = pdfDocument?.numPages ?? 0;

  // state

  const [pageNumber, setPageNumber] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [searchText, setSearchText] = useState("");

  // One-shot navigation target (e.g. "Voir le détail" on a DETAIL
  // annotation): apply then clear, so a later click on the same page
  // re-triggers navigation even if the viewer stayed mounted.
  const targetPdfPage = useSelector((s) => s.resources.targetPdfPage);
  useEffect(() => {
    if (!targetPdfPage) return;
    setPageNumber(Math.max(1, targetPdfPage.pageNumber ?? 1));
    if (typeof targetPdfPage.rotation === "number") {
      setRotation(((targetPdfPage.rotation % 360) + 360) % 360);
    }
    dispatch(setTargetPdfPage(null));
  }, [targetPdfPage, dispatch]);

  const { thumbnails } = usePdfThumbnails(pdfDocument, pageNumber);
  const { imageUrl } = usePdfPageImageUrl(pdfDocument, pageNumber, rotation);

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

  // Keep the selected thumbnail in view.
  const leftColumnRef = useRef(null);
  useEffect(() => {
    const el = leftColumnRef.current?.querySelector(".Mui-selected");
    el?.scrollIntoView({ block: "nearest" });
  }, [pageNumber]);

  // handlers

  function handleRotate(deltaDeg) {
    setRotation((r) => (((r + deltaDeg) % 360) + 360) % 360);
  }

  // render - loading / error

  if (!pdfDocument) {
    return (
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
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
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          px: 1,
          py: 0.5,
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

      {searchEnabled && (
        <Box
          sx={{
            maxHeight: "40%",
            flexShrink: 0,
            overflowY: "auto",
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
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
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {noResultS}
            </Typography>
          ) : (
            <ListPdfSearchResults
              results={results}
              selectedPageNumber={pageNumber}
              onResultClick={setPageNumber}
            />
          )}
        </Box>
      )}

      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <Box
          ref={leftColumnRef}
          sx={{
            width: 130,
            flexShrink: 0,
            overflowY: "auto",
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <ListDraggablePdfPages
            resourceId={resource.id}
            pageNumber={pageNumber}
            rotation={rotation}
            thumbnails={thumbnails}
            onPageNumberChange={setPageNumber}
          />
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            bgcolor: "background.default",
            p: 1,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${pageS} ${pageNumber}`}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <CircularProgress />
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {`${pageS} ${pageNumber} / ${numPages}`}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title={rotateCcwS}>
          <IconButton size="small" onClick={() => handleRotate(-90)}>
            <RotateLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={rotateCwS}>
          <IconButton size="small" onClick={() => handleRotate(90)}>
            <RotateRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </BoxFlexVStretch>
  );
}
