import { useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import usePlanningActions from "../hooks/usePlanningActions";

export default function MenuActionsPlanningResource({
  anchorEl,
  resource,
  slotsCount = 0,
  canMoveUp,
  canMoveDown,
  onRename,
  onClose,
}) {
  const { moveResource, deleteResource } = usePlanningActions();
  const [openDelete, setOpenDelete] = useState(false);

  async function handleMove(direction) {
    await moveResource(resource.id, direction);
    onClose();
  }

  async function handleDelete() {
    await deleteResource(resource.id);
    setOpenDelete(false);
    onClose();
  }

  return (
    <>
      <Menu
        open={Boolean(anchorEl) && !openDelete}
        anchorEl={anchorEl}
        onClose={onClose}
      >
        <MenuItem
          onClick={() => {
            onClose();
            onRename?.();
          }}
        >
          Renommer
        </MenuItem>
        <MenuItem disabled={!canMoveUp} onClick={() => handleMove(-1)}>
          Monter
        </MenuItem>
        <MenuItem disabled={!canMoveDown} onClick={() => handleMove(1)}>
          Descendre
        </MenuItem>
        <MenuItem
          onClick={() => setOpenDelete(true)}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      {openDelete && (
        <Dialog
          open
          onClose={() => setOpenDelete(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{`Supprimer "${resource.label}" ?`}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {slotsCount > 0
                ? `Supprime aussi ${slotsCount} bloc${slotsCount > 1 ? "s" : ""} du planning.`
                : "Cette ressource n'a aucun bloc."}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDelete(false)}>Annuler</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
