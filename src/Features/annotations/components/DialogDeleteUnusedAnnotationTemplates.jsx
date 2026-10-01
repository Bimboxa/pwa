import { useState, useEffect } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

import useDeleteUnusedAnnotationTemplates from "Features/annotations/hooks/useDeleteUnusedAnnotationTemplates";

// ---------------------------------------------------------------------------
// DialogDeleteUnusedAnnotationTemplates — confirm dialog of the "delete unused
// templates" cleanup. Without `listingId` it covers every listing of the scope
// (and removes the listings left empty); with `listingId` it only removes the
// unused templates of that listing, which is kept.
// ---------------------------------------------------------------------------

export default function DialogDeleteUnusedAnnotationTemplates({
  open,
  onClose,
  listingId,
}) {
  // strings

  const titleS = "Supprimer les modèles non utilisés";
  const cancelS = "Annuler";
  const deleteS = "Supprimer";
  const noneInScopeS = "Aucun modèle non utilisé dans ce scope.";
  const noneInListingS = "Aucun modèle non utilisé dans cette liste.";

  // data

  const { computeUnused, deleteUnused } = useDeleteUnusedAnnotationTemplates();

  // state

  const [candidates, setCandidates] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // helpers

  const templateCount = candidates?.templateCount ?? 0;
  const listingCount = candidates?.listingCount ?? 0;
  const hasUnused = templateCount > 0 || listingCount > 0;

  const templatesS = `${templateCount} modèle${templateCount > 1 ? "s" : ""}`;
  const listingsS = `${listingCount} liste${listingCount > 1 ? "s" : ""}`;

  let messageS = "";
  if (candidates) {
    if (listingId) {
      messageS = hasUnused
        ? `${templatesS} non utilisé${templateCount > 1 ? "s" : ""} ${templateCount > 1 ? "seront supprimés" : "sera supprimé"}.`
        : noneInListingS;
    } else {
      messageS = hasUnused
        ? `${templatesS} et ${listingsS} non utilisés seront supprimés.`
        : noneInScopeS;
    }
  }

  // effects

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCandidates(null);
    computeUnused({ listingId }).then((result) => {
      if (!cancelled) setCandidates(result);
    });
    return () => {
      cancelled = true;
    };
    // computeUnused is re-created on every render; recompute on open only
  }, [open, listingId]);

  // handlers

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteUnused(candidates);
    } finally {
      setDeleting(false);
      onClose();
    }
  }

  // render

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{messageS}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          {cancelS}
        </Button>
        <Button
          onClick={handleConfirmDelete}
          color="error"
          variant="contained"
          disabled={!hasUnused || deleting}
          autoFocus
        >
          {deleteS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
