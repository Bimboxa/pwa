import { useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import useUpdateZone from "../hooks/useUpdateZone";

export default function DialogRenameZone({ open, zone, onClose }) {
  const updateZone = useUpdateZone();

  // state

  const [label, setLabel] = useState(zone.label ?? "");

  // handlers

  async function handleRename() {
    await updateZone(zone.id, { label });
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Renommer la zone</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nom"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label) handleRename();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleRename} disabled={!label}>
          Renommer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
