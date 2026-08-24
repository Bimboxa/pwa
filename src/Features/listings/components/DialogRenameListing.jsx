import { useState, useEffect } from "react";

import useUpdateListing from "../hooks/useUpdateListing";

import { Box, TextField } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function DialogRenameListing({ open, onClose, listing }) {
  // strings

  const titleS = "Renommer la liste";
  const labelS = "Nom de la liste";
  const saveS = "Renommer";

  // data

  const updateListing = useUpdateListing();

  // state

  const [tempName, setTempName] = useState(listing?.name ?? "");
  useEffect(() => {
    setTempName(listing?.name ?? "");
  }, [listing?.id, open]);

  // helpers

  const canSave = Boolean(tempName.trim());

  // handlers

  async function handleSave() {
    const name = tempName.trim();
    if (!name) return;
    if (name !== listing?.name) {
      await updateListing({ ...listing, name }, { updateSyncFile: true });
    }
    onClose();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} width={350}>
      <HeaderTitleClose title={titleS} onClose={onClose} />
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          autoFocus
          size="small"
          label={labelS}
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) handleSave();
          }}
        />
      </Box>
      <ButtonInPanel label={saveS} onClick={handleSave} disabled={!canSave} />
    </DialogGeneric>
  );
}
