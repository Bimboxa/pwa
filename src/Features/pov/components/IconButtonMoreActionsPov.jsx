import { useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import useDeletePov from "../hooks/useDeletePov";
import usePushPovPreview from "../hooks/usePushPovPreview";
import useRemovePovPreview from "../hooks/useRemovePovPreview";

// "..." menu of a POV (same pattern as IconButtonMoreActionsAnnotationTemplate):
// used both in the properties panel header and in the list card. In the card it
// sits inside a clickable + draggable row, hence the propagation stops (the
// portaled Menu / Dialog still bubble through the React tree).
export default function IconButtonMoreActionsPov({ pov, size }) {
  const dispatch = useDispatch();

  // data

  const deletePov = useDeletePov();
  const pushPovPreview = usePushPovPreview();
  const removePovPreview = useRemovePovPreview();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);
  const [sharing, setSharing] = useState(false);

  // helpers

  const isShared = Boolean(pov?.idMaster);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleShare = async () => {
    setAnchorEl(null);
    setSharing(true);
    try {
      await pushPovPreview(pov);
    } catch (error) {
      console.error("[IconButtonMoreActionsPov] share error", error);
      dispatch(
        setToaster({ message: "Échec du partage du point de vue", isError: true })
      );
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveShare = async () => {
    setAnchorEl(null);
    setSharing(true);
    try {
      await removePovPreview(pov);
    } catch (error) {
      console.error("[IconButtonMoreActionsPov] remove share error", error);
      dispatch(
        setToaster({
          message: "Échec de la suppression du partage",
          isError: true,
        })
      );
    } finally {
      setSharing(false);
    }
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
      <IconButton
        size={size}
        onClick={handleClick}
        // keep the click away from the card's dnd-kit drag listeners
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MoreActionsIcon fontSize={size === "small" ? "small" : undefined} />
      </IconButton>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleShare} disabled={sharing}>
          {isShared ? "Mettre à jour le partage" : "Partager"}
        </MenuItem>
        <MenuItem onClick={handleRemoveShare} disabled={!isShared || sharing}>
          Supprimer le partage
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <Dialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onClick={(e) => e.stopPropagation()}
      >
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
