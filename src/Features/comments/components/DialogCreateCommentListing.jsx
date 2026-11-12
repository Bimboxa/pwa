import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setOpenDialogCreateCommentListing,
  setSelectedCommentListingId,
} from "../commentsSlice";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import createCommentListingService from "../services/createCommentListingService";

// "Nouvelle liste de commentaires": a comment always belongs to a listing, so
// this is the first step of the module (opened by the panel button, and by
// the "+ Commentaire" commands when the scope has no listing yet).
export default function DialogCreateCommentListing() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Nouvelle liste d'infos";
  const descriptionS =
    "Les infos d'une liste se lisent dans l'ordre, comme un guide de visite du Krto.";
  const nameS = "Nom de la liste";
  const namePlaceholderS = "Infos";
  const cancelS = "Annuler";
  const createS = "Créer";

  // data

  const open = useSelector((s) => s.comments.openDialogCreateListing);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const appConfig = useAppConfig();

  // state

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogCreateCommentListing(false));
    setName("");
  }

  async function handleCreate() {
    if (!projectId || !scopeId || creating) return;
    setCreating(true);
    try {
      const listing = await createCommentListingService({
        projectId,
        scopeId,
        name,
        appConfig,
      });
      if (listing) dispatch(setSelectedCommentListingId(listing.id));
      handleClose();
    } finally {
      setCreating(false);
    }
  }

  // render

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <DialogContentText variant="body2">{descriptionS}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          variant="outlined"
          size="small"
          label={nameS}
          placeholder={namePlaceholderS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{cancelS}</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating || !scopeId}
        >
          {createS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
