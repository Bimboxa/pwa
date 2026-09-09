import { useState } from "react";

import { useSelector } from "react-redux";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import useCreateBaseMapListing from "../hooks/useCreateBaseMapListing";

// Creation dialog of a base map folder (a BASE_MAP listing). The Fond de plan
// module creates one straight from its "+" with a generated name; the SCOPE
// module asks for the name, like the other listing families do.
export default function DialogCreateBaseMapListing({
  open,
  onClose,
  onCreated,
}) {
  const createBaseMapListing = useCreateBaseMapListing();

  // strings

  const titleS = "Nouveau dossier de fonds de plan";
  const nameS = "Nom";
  const cancelS = "Annuler";
  const createS = "Créer";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [name, setName] = useState("");

  // handlers

  async function handleCreate() {
    const listing = await createBaseMapListing({ projectId, title: name });
    if (onCreated) onCreated(listing);
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={nameS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name) handleCreate();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelS}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!name}>
          {createS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
