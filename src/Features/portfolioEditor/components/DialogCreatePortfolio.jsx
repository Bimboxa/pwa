import { useState } from "react";

import { DialogTitle, Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function DialogCreatePortfolio({ open, onClose, onCreate }) {
  // strings

  const titleS = "Nouveau portfolio";
  const labelS = "Nom";
  const createS = "Créer";

  // state

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // helpers

  const disabled = !name.trim();

  // handlers

  async function handleCreate() {
    if (loading || disabled) return;
    setLoading(true);
    await onCreate(name.trim());
    setName("");
    setLoading(false);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !disabled) {
      handleCreate();
    }
  }

  // render

  if (!open) return null;

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">
      <DialogTitle>{titleS}</DialogTitle>
      <BoxFlexVStretch>
        <Box sx={{ px: 1 }} onKeyDown={handleKeyDown}>
          <FieldTextV2
            label={labelS}
            value={name}
            onChange={(e) => setName(e)}
            options={{ fullWidth: true, showLabel: true, autoFocus: true }}
          />
        </Box>
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreate}
        variant="contained"
        loading={loading}
        disabled={disabled}
      />
    </DialogGeneric>
  );
}
