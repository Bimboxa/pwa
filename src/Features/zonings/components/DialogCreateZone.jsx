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

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

import useCreateZone from "../hooks/useCreateZone";
import useArmZoneDrawing from "../hooks/useArmZoneDrawing";

import { DEFAULT_ZONE_COLOR } from "../constants/zoningEntityModel";

export default function DialogCreateZone({ open, listing, parentZone, onClose }) {
  const createZone = useCreateZone();
  const armZoneDrawing = useArmZoneDrawing();

  // state

  const [label, setLabel] = useState("");
  const [color, setColor] = useState(parentZone?.color ?? DEFAULT_ZONE_COLOR);

  // strings

  const title = parentZone
    ? `Nouvelle sous-zone de "${parentZone.label}"`
    : "Nouvelle zone";

  // handlers

  async function handleCreate() {
    const zone = await createZone({
      listing,
      parentId: parentZone?.id ?? null,
      label,
      color,
    });
    onClose();
    if (zone) armZoneDrawing(zone);
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nom"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label) handleCreate();
          }}
          sx={{ mt: 1 }}
        />
        <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
          <CirclePicker
            onChange={(c) => setColor(c.hex)}
            color={color}
            colors={defaultColors}
            circleSize={20}
            circleSpacing={9}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!label}>
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
