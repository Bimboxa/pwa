import { useState } from "react";

import {
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import useDeletePov from "../hooks/useDeletePov";

// "..." header menu of the POV properties panel (same pattern as
// IconButtonMoreActionsAnnotationTemplate): actions on the selected POV.
export default function IconButtonMoreActionsPov({ pov }) {
  // data

  const deletePov = useDeletePov();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = () => {
    setAnchorEl(null);
    setOpenDelete(true);
  };

  const handleConfirmDelete = async () => {
    setOpenDelete(false);
    await deletePov(pov?.id);
  };

  // render

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>Supprimer le point de vue</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Le point de vue sera supprimé de la liste.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)} variant="outlined">
            Annuler
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
