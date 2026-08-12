import { useState, useEffect } from "react";

import { Box, IconButton, Typography } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import db from "App/db/db";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSelectFolioResource from "./SectionSelectFolioResource";
import SectionSelectFolioPage from "./SectionSelectFolioPage";

// Folio assignment dialog: step 1 picks a project resource, step 2 picks a
// page in the PDF (step = whether a resource is selected). Opening with an
// initialFolio lands directly on step 2 on the current page.
export default function DialogSelectFolio({
  open,
  onClose,
  initialFolio,
  onConfirm,
}) {
  // strings

  const titleS = "Choisir un folio";

  // state

  const [resource, setResource] = useState(null);

  useEffect(() => {
    if (!open) {
      setResource(null);
      return;
    }
    if (!initialFolio?.resourceId) return;
    let cancelled = false;
    db.resources.get(initialFolio.resourceId).then((row) => {
      if (!cancelled && row && !row.deletedAt) setResource(row);
    });
    return () => {
      cancelled = true;
    };
  }, [open, initialFolio?.resourceId]);

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} title={titleS} vh={80} vw={80}>
      {resource ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", px: 1, pb: 0.5 }}>
            <IconButton onClick={() => setResource(null)}>
              <Back />
            </IconButton>
            <Typography variant="body2" sx={{ ml: 1, fontWeight: "bold" }}>
              {resource.name}
            </Typography>
          </Box>
          <SectionSelectFolioPage
            resource={resource}
            initialPageNumber={
              initialFolio?.resourceId === resource.id
                ? initialFolio?.pageNumber
                : undefined
            }
            initialRotation={
              initialFolio?.resourceId === resource.id
                ? initialFolio?.rotation
                : undefined
            }
            onCancel={onClose}
            onConfirm={onConfirm}
          />
        </>
      ) : (
        <SectionSelectFolioResource onResourceSelect={setResource} />
      )}
    </DialogGeneric>
  );
}
