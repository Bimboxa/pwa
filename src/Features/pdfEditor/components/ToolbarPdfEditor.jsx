import { useState } from "react";

import {
  Box,
  Button,
  ButtonBase,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowDropDown,
  ChevronLeft,
  ChevronRight,
  Close,
  FormatListBulleted,
  PictureAsPdf,
  RotateLeft,
  RotateRight,
  Visibility,
  VisibilityOff,
  ZoomIn,
  ZoomOut,
} from "@mui/icons-material";

export const PDF_EDITOR_TOOLBAR_HEIGHT = 48;

// Header of the PDF editor layer. Every control sits on the LEFT: the right
// tools panel floats over the right side of the layer.
//
// The highlights "pill" is one control with two actions: the eye shows /
// hides the highlighted passages on the pages, the list opens the
// "sommaire" popper (anchored to the pill through `onPassagesAnchor`).
export default function ToolbarPdfEditor({
  resource,
  pdfResources,
  onResourceChange,
  pageNumber,
  numPages,
  onPageChange,
  onRotate,
  zoom,
  canZoomOut,
  canZoomIn,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  showPassages,
  showHighlights,
  onToggleHighlights,
  passagesCount,
  passagesPopperOpen,
  onTogglePassagesPopper,
  onPassagesAnchor,
  onClose,
}) {
  // strings

  const closeS = "Fermer (Échap)";
  const otherDocumentS = "Ouvrir un autre document";
  const previousPageS = "Page précédente (←)";
  const nextPageS = "Page suivante (→)";
  const rotateCcwS = "Pivoter à gauche";
  const rotateCwS = "Pivoter à droite";
  const zoomOutS = "Zoom arrière";
  const zoomInS = "Zoom avant";
  const zoomResetS = "Page entière (Ctrl + molette pour zoomer)";
  const hideHighlightsS = "Masquer les passages surlignés";
  const showHighlightsS = "Afficher les passages surlignés";
  const passagesS = "Sommaire des passages surlignés";

  // state

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // helpers

  const hasPages = numPages > 0;
  const otherResources = (pdfResources ?? []).filter(
    (r) => r.id !== resource?.id
  );
  const canSwitchDocument = otherResources.length > 0;

  // handlers

  function handleResourceClick(id) {
    setMenuAnchorEl(null);
    onResourceChange(id);
  }

  // render

  const divider = (
    <Divider orientation="vertical" flexItem sx={{ my: 1.25, mx: 0.5 }} />
  );

  return (
    <Box
      sx={{
        height: PDF_EDITOR_TOOLBAR_HEIGHT,
        minHeight: PDF_EDITOR_TOOLBAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        px: 0.5,
        bgcolor: "background.paper",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Tooltip title={closeS}>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* document (selector of the PDF resources of the scope) */}
      <Tooltip title={canSwitchDocument ? otherDocumentS : ""}>
        <span>
          <Button
            size="small"
            color="inherit"
            disabled={!canSwitchDocument}
            startIcon={<PictureAsPdf fontSize="small" color="action" />}
            endIcon={canSwitchDocument ? <ArrowDropDown /> : null}
            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
            sx={{
              textTransform: "none",
              maxWidth: 280,
              "&.Mui-disabled": { color: "text.primary" },
            }}
          >
            <Typography variant="body2" noWrap>
              {resource?.name ?? ""}
            </Typography>
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        {otherResources.map((r) => (
          <MenuItem key={r.id} dense onClick={() => handleResourceClick(r.id)}>
            <ListItemText
              primary={r.name}
              slotProps={{ primary: { variant: "body2", noWrap: true } }}
            />
          </MenuItem>
        ))}
      </Menu>

      {divider}

      {/* page */}
      <Tooltip title={previousPageS}>
        <span>
          <IconButton
            size="small"
            disabled={!hasPages || pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 64, textAlign: "center", whiteSpace: "nowrap" }}
      >
        {hasPages ? `${pageNumber} / ${numPages}` : "–"}
      </Typography>
      <Tooltip title={nextPageS}>
        <span>
          <IconButton
            size="small"
            disabled={!hasPages || pageNumber >= numPages}
            onClick={() => onPageChange(pageNumber + 1)}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {divider}

      {/* rotation */}
      <Tooltip title={rotateCcwS}>
        <span>
          <IconButton
            size="small"
            disabled={!hasPages}
            onClick={() => onRotate(-90)}
          >
            <RotateLeft fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={rotateCwS}>
        <span>
          <IconButton
            size="small"
            disabled={!hasPages}
            onClick={() => onRotate(90)}
          >
            <RotateRight fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {divider}

      {/* zoom */}
      <Tooltip title={zoomOutS}>
        <span>
          <IconButton
            size="small"
            disabled={!hasPages || !canZoomOut}
            onClick={onZoomOut}
          >
            <ZoomOut fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={zoomResetS}>
        <span>
          <Button
            size="small"
            color="inherit"
            disabled={!hasPages}
            onClick={onZoomReset}
            sx={{ minWidth: 52, px: 0.5, color: "text.secondary" }}
          >
            {`${Math.round(zoom * 100)} %`}
          </Button>
        </span>
      </Tooltip>
      <Tooltip title={zoomInS}>
        <span>
          <IconButton
            size="small"
            disabled={!hasPages || !canZoomIn}
            onClick={onZoomIn}
          >
            <ZoomIn fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {/* highlighted passages: visibility + "sommaire" popper */}
      {showPassages && (
        <>
          {divider}
          <Paper
            ref={onPassagesAnchor}
            variant="outlined"
            sx={{
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
              px: 0.25,
              ml: 0.5,
            }}
          >
            <Tooltip title={showHighlights ? hideHighlightsS : showHighlightsS}>
              <IconButton size="small" onClick={onToggleHighlights}>
                {showHighlights ? (
                  <Visibility fontSize="small" color="secondary" />
                ) : (
                  <VisibilityOff fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title={passagesS}>
              <ButtonBase
                onClick={onTogglePassagesPopper}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  height: 30,
                  px: 0.75,
                  borderRadius: 4,
                  color: passagesPopperOpen
                    ? "secondary.main"
                    : "text.secondary",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <FormatListBulleted fontSize="small" />
                <Typography variant="caption" sx={{ lineHeight: 1 }}>
                  {passagesCount}
                </Typography>
              </ButtonBase>
            </Tooltip>
          </Paper>
        </>
      )}
    </Box>
  );
}
