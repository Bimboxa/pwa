import { useEffect, useRef } from "react";
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
import ListPdfSearchResults from "Features/detailFolio/components/ListPdfSearchResults";

import usePdfPagesViewerState from "../hooks/usePdfPagesViewerState";
import ListPdfPages from "./ListPdfPages";
import ViewerPdfDocumentPage from "./ViewerPdfDocumentPage";
import SectionAddDetailToBaseMap from "./SectionAddDetailToBaseMap";

// Page-based PDF viewer for the resource detail panel: left column of
// selectable page thumbnails, main area previewing the selected page with a
// floating "page + ±90° rotation" control, and (BASE_MAPS module) a bottom
// section arming the "add DETAIL to base map" placement for the viewed page.
//
// Rotation model: the ±90° buttons hold a DELTA on top of each page's
// intrinsic /Rotate; anything sent downstream (render, armed placement
// context) is the ABSOLUTE effective rotation (intrinsic + delta), matching
// the app-wide folio.rotation convention.
//
// `isDocument` (text document, not a plan): the page is not converted to an
// image — ViewerPdfDocumentPage renders it with a selectable text layer and
// the highlights linked to business objects.
export default function ViewerPdfPages({ resource, file, isDocument }) {
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

  // One-shot navigation target (e.g. "Voir le détail" on a DETAIL
  // annotation), consumed then cleared — see usePdfPagesViewerState.
  const targetPdfPage = useSelector((s) => s.resources.targetPdfPage);

  const {
    pdfDocument,
    pdfError,
    progress,
    numPages,
    pageNumber,
    setPageNumber,
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
  } = usePdfPagesViewerState({
    resource,
    file,
    isDocument,
    targetPdfPage,
    onTargetConsumed: () => dispatch(setTargetPdfPage(null)),
  });

  // Keep the selected thumbnail in view.
  const leftColumnRef = useRef(null);
  useEffect(() => {
    const el = leftColumnRef.current?.querySelector(".Mui-selected");
    el?.scrollIntoView({ block: "nearest" });
  }, [pageNumber]);

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
          <ListPdfPages
            pageNumber={pageNumber}
            thumbnails={thumbnails}
            onPageNumberChange={setPageNumber}
          />
        </Box>

        <Box
          sx={{
            position: "relative",
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
          {isDocument ? (
            <ViewerPdfDocumentPage
              resource={resource}
              pdfDocument={pdfDocument}
              pageNumber={pageNumber}
              rotation={effectiveRotation}
              rotationDelta={rotationDelta}
              flashHighlightId={flashHighlightId}
              flashNonce={flashNonce}
            />
          ) : imageUrl ? (
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

          {/* floating page + rotation controls */}
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              pl: 1,
              pr: 0.5,
              py: 0.25,
              borderRadius: 1,
              bgcolor: "background.paper",
              boxShadow: 1,
              opacity: 0.92,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {`${pageS} ${pageNumber} / ${numPages}`}
            </Typography>
            <Tooltip title={rotateCcwS}>
              <IconButton size="small" onClick={() => rotate(-90)}>
                <RotateLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={rotateCwS}>
              <IconButton size="small" onClick={() => rotate(90)}>
                <RotateRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <SectionAddDetailToBaseMap
        resource={resource}
        pageNumber={pageNumber}
        effectiveRotation={effectiveRotation}
        pdfDocument={pdfDocument}
      />
    </BoxFlexVStretch>
  );
}
