import { useState, useMemo, useEffect, useRef } from "react";

import {
  Box,
  Alert,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import SelectorPdfPage from "Features/baseMapCreator/components/SelectorPdfPage";
import ListPdfSearchResults from "./ListPdfSearchResults";

import useResourceFile from "Features/resources/hooks/useResourceFile";
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfThumbnails from "Features/pdf/hooks/usePdfThumbnails";
import usePdfPageIntrinsicRotation from "Features/pdf/hooks/usePdfPageIntrinsicRotation";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";
import usePdfPagesText from "../hooks/usePdfPagesText";
import searchPdfPages from "../utils/searchPdfPages";
import getPdfPageThumbnailDataUrl from "../utils/getPdfPageThumbnailDataUrl";

const MIN_SEARCH_LENGTH = 2;

// Step 2 of the folio dialog: pick a page of the selected PDF resource.
// Left: page thumbnails; center: preview of the selected page; right: keyword
// search over the PDF text (lazily indexed) + direct page number input.
//
// Rotation model: the ±90° buttons hold a DELTA on top of each page's
// intrinsic /Rotate; the confirmed folio.rotation stays ABSOLUTE
// (intrinsic + delta), matching the app-wide convention.
export default function SectionSelectFolioPage({
  resource,
  initialPageNumber,
  initialRotation,
  onCancel,
  onConfirm,
}) {
  // strings

  const missingFileS =
    "Fichier PDF absent en local. Rechargez-le depuis le panneau Ressources.";
  const loadingPdfS = "Chargement du PDF...";
  const searchS = "Rechercher dans le PDF...";
  const indexingS = "Indexation";
  const pagesS = "pages";
  const noResultS = "Aucun résultat";
  const pageS = "Page";
  const cancelS = "Annuler";
  const confirmS = "Valider";
  const rotateCcwS = "Pivoter à gauche";
  const rotateCwS = "Pivoter à droite";

  // data

  const {
    file,
    loading: fileLoading,
    fileIsMissing,
  } = useResourceFile(resource);
  const { pdfDocument, error: pdfError, progress } = usePdfDocument(file);
  const numPages = pdfDocument?.numPages ?? 0;

  // state

  const [pageNumber, setPageNumber] = useState(initialPageNumber ?? 1);
  const [rotationDelta, setRotationDelta] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [confirming, setConfirming] = useState(false);

  // One-shot: initialRotation (absolute, from an existing folio) → delta vs
  // the intrinsic /Rotate of the initial page.
  const initialDeltaAppliedRef = useRef(false);
  useEffect(() => {
    if (initialDeltaAppliedRef.current) return;
    if (!pdfDocument || typeof initialRotation !== "number") return;
    initialDeltaAppliedRef.current = true;
    pdfDocument
      .getPage(initialPageNumber ?? 1)
      .then((page) => {
        const delta = initialRotation - (page.rotate ?? 0);
        setRotationDelta(((delta % 360) + 360) % 360);
      })
      .catch(() => {});
  }, [pdfDocument, initialRotation, initialPageNumber]);

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
    pdfDocument,
    pageNumber,
    effectiveRotation
  );

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

  // Keep the selected page thumbnail in view when the selection jumps from a
  // search result click.
  const leftColumnRef = useRef(null);
  useEffect(() => {
    const el = leftColumnRef.current?.querySelector(".Mui-selected");
    el?.scrollIntoView({ block: "nearest" });
  }, [pageNumber]);

  // handlers

  function handlePageNumberInput(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    setPageNumber(Math.min(Math.max(parsed, 1), Math.max(numPages, 1)));
  }

  function handleRotate(deltaDeg) {
    setRotationDelta((r) => (((r + deltaDeg) % 360) + 360) % 360);
  }

  async function handleConfirm() {
    setConfirming(true);
    const rotation = effectiveRotation ?? 0;
    let thumbnail = null;
    try {
      thumbnail = await getPdfPageThumbnailDataUrl(
        pdfDocument,
        pageNumber,
        rotation
      );
    } catch (err) {
      console.error("[SectionSelectFolioPage] thumbnail render error", err);
    }
    onConfirm({
      type: "PDF_PAGE",
      resourceId: resource.id,
      pageNumber,
      rotation,
      thumbnail,
    });
  }

  // render - file missing

  if (fileIsMissing) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">{missingFileS}</Alert>
      </Box>
    );
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
              variant={
                progress?.total && !fileLoading
                  ? "determinate"
                  : "indeterminate"
              }
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
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <Box
          ref={leftColumnRef}
          sx={{ width: 150, flexShrink: 0, overflowY: "auto" }}
        >
          <SelectorPdfPage
            pageNumber={pageNumber}
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

        <Box
          sx={{
            width: 300,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ p: 1 }}>
            <SearchBar
              value={searchText}
              onChange={setSearchText}
              placeholder={searchS}
              fullWidth
            />
          </Box>

          {isIndexing && (
            <Box sx={{ px: 1, pb: 1 }}>
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

          <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
            {searchEnabled && results.length === 0 && !isIndexing ? (
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
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <TextField
          label={pageS}
          type="number"
          size="small"
          value={pageNumber}
          onChange={(e) => handlePageNumberInput(e.target.value)}
          slotProps={{ htmlInput: { min: 1, max: numPages } }}
          sx={{ width: 100 }}
        />
        <Typography variant="body2" color="text.secondary">
          {`${pageS} ${pageNumber} / ${numPages}`}
        </Typography>

        <Tooltip title={rotateCcwS}>
          <IconButton onClick={() => handleRotate(-90)}>
            <RotateLeftIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={rotateCwS}>
          <IconButton onClick={() => handleRotate(90)}>
            <RotateRightIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Button onClick={onCancel}>{cancelS}</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={confirming}
          startIcon={confirming ? <CircularProgress size={16} /> : null}
        >
          {confirmS}
        </Button>
      </Box>
    </BoxFlexVStretch>
  );
}
