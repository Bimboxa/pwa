import { useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import AvatarListing from "./AvatarListing";

import useUpdateListing from "../hooks/useUpdateListing";
import { getDefaultListingAvatarString } from "../utils/getListingAvatarString";

// Rename dialog of any listing: name + avatar (1-3 chars, empty = derived
// from the name). Goes through useUpdateListing (ownership guard + sync
// file), not a raw db.listings.update.
export default function DialogRenameListing({ open, listing, onClose }) {
  const updateListing = useUpdateListing();

  // strings

  const titleS = "Renommer la liste";
  const nameS = "Nom";
  const avatarS = "Avatar";
  const avatarHelperS = "Vide = automatique";
  const cancelS = "Annuler";
  const renameS = "Renommer";

  // state

  const [name, setName] = useState(listing?.name ?? "");
  const [avatarString, setAvatarString] = useState(listing?.avatarString ?? "");

  // helpers

  const previewListing = { ...listing, name, avatarString };
  const avatarPlaceholder = getDefaultListingAvatarString({ ...listing, name });

  // handlers

  async function handleRename() {
    await updateListing({
      id: listing.id,
      name,
      avatarString: avatarString.trim() || null,
    });
    onClose();
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && name) handleRename();
  };

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <Box
          sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mt: 1 }}
        >
          <AvatarListing
            listing={previewListing}
            size={40}
            variant="selected"
          />
          <TextField
            size="small"
            label={avatarS}
            value={avatarString}
            onChange={(e) => setAvatarString(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={avatarPlaceholder}
            helperText={avatarHelperS}
            slotProps={{
              htmlInput: {
                maxLength: 3,
                style: { fontWeight: 700, textAlign: "center" },
              },
              inputLabel: { shrink: true },
            }}
            sx={{ width: 96, flexShrink: 0 }}
          />
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={nameS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelS}</Button>
        <Button variant="contained" onClick={handleRename} disabled={!name}>
          {renameS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
