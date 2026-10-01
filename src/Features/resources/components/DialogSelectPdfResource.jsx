import { useState, useEffect } from "react";

import { Box, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ListResources from "./ListResources";

import useResources from "../hooks/useResources";

const isPdfResource = (resource) => resource.fileType === "PDF";

// Picker of the project's PDF resources (full PDFs and extracted PDF_PAGE
// rows alike). onSelect(resource) returns true when the caller consumed the
// resource, false when its file is missing: the dialog then stays open and
// shows a hint. `filter` widens the list to other resources (Prompt IA: DXF,
// IFC…), with its own `title` / `emptyLabel`.
export default function DialogSelectPdfResource({
  open,
  onClose,
  onSelect,
  filter = isPdfResource,
  title,
  emptyLabel,
}) {
  // strings

  const titleS = title ?? "Choisir un PDF des ressources";
  const noPdfS = emptyLabel ?? "Aucune ressource PDF dans le projet.";
  const fileMissingS =
    "Fichier introuvable : réattachez la ressource depuis le panneau Ressources.";

  // data

  const resources = useResources();
  const pdfResources = resources.filter(filter);

  // state

  const [fileMissing, setFileMissing] = useState(false);

  useEffect(() => {
    if (!open) setFileMissing(false);
  }, [open]);

  // handlers

  async function handleResourceClick(resource) {
    const ok = await onSelect?.(resource);
    setFileMissing(ok === false);
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} title={titleS} vh={80} vw={60}>
      <Box
        sx={{
          width: 1,
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {fileMissing && (
          <Typography variant="caption" color="error" sx={{ px: 2, py: 1 }}>
            {fileMissingS}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
          {pdfResources.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {noPdfS}
            </Typography>
          ) : (
            <ListResources
              resources={pdfResources}
              onResourceClick={handleResourceClick}
            />
          )}
        </Box>
      </Box>
    </DialogGeneric>
  );
}
