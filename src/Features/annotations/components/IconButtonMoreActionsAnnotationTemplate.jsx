import { useState } from "react";

import { useDispatch } from "react-redux";

import useDeleteAnnotationTemplate from "../hooks/useDeleteAnnotationTemplate";
import useCreateAnnotationTemplate from "../hooks/useCreateAnnotationTemplate";

import { setSelectedItem } from "Features/selection/selectionSlice";

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

export default function IconButtonMoreActionsAnnotationTemplate({
  annotationTemplate,
}) {
  const dispatch = useDispatch();

  // data

  const { deleteAnnotationTemplate, getAnnotationCount } =
    useDeleteAnnotationTemplate();
  const createAnnotationTemplate = useCreateAnnotationTemplate();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);
  const [annotationCount, setAnnotationCount] = useState(0);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDuplicate = async () => {
    const newTemplate = {
      ...annotationTemplate,
      label: annotationTemplate.label + " (copie)",
    };
    await createAnnotationTemplate(newTemplate);
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    setAnchorEl(null);
    const count = await getAnnotationCount(annotationTemplate.id);
    setAnnotationCount(count);
    setOpenDelete(true);
  };

  const handleConfirmDelete = async () => {
    await deleteAnnotationTemplate(annotationTemplate.id);
    dispatch(setSelectedItem({}));
    setOpenDelete(false);
  };

  // render

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>Supprimer le modèle</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {annotationCount > 0
              ? `${annotationCount} annotation${annotationCount > 1 ? "s" : ""} associée${annotationCount > 1 ? "s" : ""} à ce modèle seront également supprimées.`
              : "Aucune annotation associée à ce modèle."}
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
