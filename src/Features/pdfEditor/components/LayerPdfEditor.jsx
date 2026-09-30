import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  closePdfEditor,
  selectPdfEditorOpen,
  setPdfEditorPassagesPopperOpen,
} from "../pdfEditorSlice";

import { Box, IconButton, Slide, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

import db from "App/db/db";

import PdfEditorContent from "./PdfEditorContent";
import isEditableTarget from "Features/baseMapsGrid/utils/isEditableTarget";

// PDF editor: a layer of the editors area (mounted by SectionViewer) that
// slides up from the bottom OVER the displayed editor, 2D or 3D, and covers
// it entirely. The editor underneath stays mounted and untouched.
//
// zIndex 40: above the editors (0), the planning panel / base maps grid (5),
// the hover left drawers (20) and the capture / POV bars (30); UNDER the
// right tools panel (drawer 200, band 300), which floats over it.
//
// Opened by the document links of the business objects (useOpenResourceRel);
// closed by its button, Escape, a scope / project change and a switch to a
// module it is not opened from (pdfEditorSlice).
export default function LayerPdfEditor() {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const missingS = "Document introuvable dans les ressources";
  const closeS = "Fermer";

  // data

  const open = useSelector(selectPdfEditorOpen);
  const resourceId = useSelector((s) => s.pdfEditor.resourceId);

  const resource = useLiveQuery(async () => {
    if (!resourceId) return null;
    const row = await db.resources.get(resourceId);
    return row && !row.deletedAt ? row : null;
  }, [resourceId]);

  // helpers

  // The live query keeps the previous row while the next one loads: never
  // hand a stale resource to the content (it would consume the navigation
  // target meant for the new document).
  const displayedResource = resource?.id === resourceId ? resource : null;
  const isMissing = resource === null && Boolean(resourceId);

  // effects - Escape closes the "sommaire" popper first, then the layer.
  // Capture phase + stopImmediatePropagation: the editors underneath must
  // not also react to that Escape.

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (isEditableTarget(e.target)) return;
      // a menu / dialog closes itself first
      if (e.target?.closest?.(".MuiModal-root, .MuiPopover-root")) return;
      if (store.getState().pdfEditor.passagesPopperOpen) {
        dispatch(setPdfEditorPassagesPopperOpen(false));
      } else {
        dispatch(closePdfEditor());
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, store, dispatch]);

  // render

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          bgcolor: "background.default",
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {displayedResource ? (
          <PdfEditorContent
            key={displayedResource.id}
            resource={displayedResource}
          />
        ) : (
          isMissing && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
              <IconButton
                size="small"
                title={closeS}
                onClick={() => dispatch(closePdfEditor())}
              >
                <Close fontSize="small" />
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {missingS}
              </Typography>
            </Box>
          )
        )}
      </Box>
    </Slide>
  );
}
