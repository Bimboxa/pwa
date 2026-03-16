import { useState } from "react";

import { DialogTitle, Box, TextField } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function DialogCreateLayer({ open, onClose, onConfirm }) {
  // strings

  const titleS = "Nouveau calque";
  const createS = "Créer";

  // state

  const [name, setName] = useState("");

  // handlers

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setName("");
  };

  const handleClose = () => {
    setName("");
    onClose();
  };

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} width="320px">
      <DialogTitle>{titleS}</DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <TextField
          autoFocus
          label="Nom du calque"
          size="small"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            e.stopPropagation();
          }}
        />
      </Box>
      <ButtonInPanelV2
        onClick={handleCreate}
        label={createS}
        variant="contained"
        disabled={!name.trim()}
      />
    </DialogGeneric>
  );
}
