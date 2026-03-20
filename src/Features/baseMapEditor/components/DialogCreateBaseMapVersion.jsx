import { useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  ListSubheader,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";

import db from "App/db/db";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

function formatDefaultLabel() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `Version ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function DialogCreateBaseMapVersion({ open, onClose, onConfirm }) {
  // data

  const listings = useProjectBaseMapListings({});
  const { value: baseMaps } = useBaseMaps({});

  // state

  const [label, setLabel] = useState(formatDefaultLabel);
  const [selectedBaseMapId, setSelectedBaseMapId] = useState("");

  // Build grouped menu items
  function buildMenuItems() {
    if (!listings || !baseMaps) return [];
    const items = [];
    for (const listing of listings) {
      const listingBaseMaps = baseMaps.filter(
        (bm) => bm.listingId === listing.id
      );
      if (listingBaseMaps.length === 0) continue;
      items.push(
        <ListSubheader key={`header-${listing.id}`} sx={{ lineHeight: "32px" }}>
          {listing.name || "Sans nom"}
        </ListSubheader>
      );
      for (const bm of listingBaseMaps) {
        const thumbnail = typeof bm.getThumbnail === "function" ? bm.getThumbnail() : null;
        items.push(
          <MenuItem key={bm.id} value={bm.id}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {thumbnail && (
                <Box
                  component="img"
                  src={thumbnail}
                  sx={{ width: 24, height: 24, borderRadius: 0.5, objectFit: "cover" }}
                />
              )}
              <Typography variant="body2">{bm.name || "Sans nom"}</Typography>
            </Box>
          </MenuItem>
        );
      }
    }
    return items;
  }

  // handlers

  async function handleConfirm() {
    if (!label.trim() || !selectedBaseMapId) return;
    const sourceBaseMap = baseMaps?.find((bm) => bm.id === selectedBaseMapId);
    if (!sourceBaseMap) return;

    // Fetch version directly from DB to avoid stale state
    const bmVersions = await db.baseMapVersions
      .where("baseMapId")
      .equals(selectedBaseMapId)
      .toArray();
    const liveVersions = bmVersions.filter((v) => !v.deletedAt);
    const sourceVersion =
      liveVersions.find((v) => v.isActive) || liveVersions[0] || null;
    if (!sourceVersion) return;

    onConfirm({
      label: label.trim(),
      sourceBaseMap,
      sourceVersion,
    });
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nouvelle version</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField
          label="Nom de la version"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          size="small"
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
        />

        <FormControl fullWidth size="small">
          <InputLabel>Image source (fond de plan)</InputLabel>
          <Select
            value={selectedBaseMapId}
            onChange={(e) => setSelectedBaseMapId(e.target.value)}
            label="Image source (fond de plan)"
            MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
          >
            {buildMenuItems()}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!label.trim() || !selectedBaseMapId}
        >
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
