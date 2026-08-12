import { useState, useEffect, useRef } from "react";

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
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfThumbnails from "Features/pdf/hooks/usePdfThumbnails";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";

import ListDraggablePdfPages from "./ListDraggablePdfPages";

// Page-based PDF viewer for the resource detail panel: left column of page
// thumbnails (each one selectable AND draggable towards the 2D editor to
// create a DETAIL annotation with folio = the page), main area previewing
// the selected page with a ±90° rotation control (the rotation is carried
// into the folio of a dropped page, like the manual folio dialog).
export default function ViewerPdfPages({ resource, file }) {
  // strings

  const loadingPdfS = "Chargement du PDF...";
  const pageS = "Page";
  const rotateCcwS = "Pivoter à gauche";
  const rotateCwS = "Pivoter à droite";

  // data

  const { pdfDocument, error: pdfError, progress } = usePdfDocument(file);
  const numPages = pdfDocument?.numPages ?? 0;

  // state

  const [pageNumber, setPageNumber] = useState(1);
  const [rotation, setRotation] = useState(0);

  const { thumbnails } = usePdfThumbnails(pdfDocument, pageNumber);
  const { imageUrl } = usePdfPageImageUrl(pdfDocument, pageNumber, rotation);

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
