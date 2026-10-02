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
  onDuplicated,
}) {
  const dispatch = useDispatch();

  // data

  const { deleteAnnotationTemplate, getAnnotationCount, getMeshPaintCount } =
    useDeleteAnnotationTemplate();
  const createAnnotationTemplate = useCreateAnnotationTemplate();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);
  const [annotationCount, setAnnotationCount] = useState(0);
  // Parts painted with the template (« Pinceau »): deleted with it.
  const [meshPaintCount, setMeshPaintCount] = useState(0);

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
    const createdTemplate = await createAnnotationTemplate(newTemplate);
    setAnchorEl(null);
    // Let the host select the duplicate in its own context (Dessin panel
    // detail vs right-panel selection).
    if (createdTemplate) onDuplicated?.(createdTemplate);
  };

  const handleDelete = async () => {
    setAnchorEl(null);
    const [count, paintCount] = await Promise.all([
      getAnnotationCount(annotationTemplate.id),
      getMeshPaintCount(annotationTemplate.id),
    ]);
    setAnnotationCount(count);
    setMeshPaintCount(paintCount);
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
          {meshPaintCount > 0 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {`${meshPaintCount} partie${meshPaintCount > 1 ? "s" : ""} peinte${meshPaintCount > 1 ? "s" : ""} avec ce modèle ${meshPaintCount > 1 ? "seront" : "sera"} également supprimée${meshPaintCount > 1 ? "s" : ""}.`}
            </Typography>
          )}
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
