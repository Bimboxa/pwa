import { useDispatch, useSelector } from "react-redux";

import { setPendingResult, setShowConfirmDialog } from "../annotationsAutoSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";

export default function DialogAnnotationsAutoConfirm() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.annotationsAuto.showConfirmDialog);
  const pendingResult = useSelector((s) => s.annotationsAuto.pendingResult);

  // helpers

  const annotationsCount = pendingResult?.annotations?.length ?? 0;
  const pointsCount = pendingResult?.points?.length ?? 0;
  const relsCount = pendingResult?.rels?.length ?? 0;

  const categorySet = new Set(
    (pendingResult?.rels ?? []).map(
      (r) => `${r.nomenclatureKey}:${r.categoryKey}`
    )
  );
  const categories = [...categorySet];

  // handlers

  function handleCancel() {
    dispatch(setShowConfirmDialog(false));
    dispatch(setPendingResult(null));
  }

  async function handleConfirm() {
    if (!pendingResult) return;

    const { annotations, points, rels } = pendingResult;

    // Spread each object to create extensible copies (Redux freezes state objects,
    // but Dexie audit hooks need to add createdAt/updatedAt properties).
    await db.points.bulkAdd(points.map((p) => ({ ...p })));
    await db.annotations.bulkAdd(annotations.map((a) => ({ ...a })));
    if (rels.length > 0) {
      await db.relAnnotationMappingCategory.bulkAdd(rels.map((r) => ({ ...r })));
    }

    dispatch(triggerAnnotationsUpdate());
    dispatch(setShowConfirmDialog(false));
    dispatch(setPendingResult(null));
  }

  // render

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Confirmer la création automatique</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 1 }}>
          <Typography variant="body2">
            <strong>{annotationsCount}</strong> annotation
            {annotationsCount !== 1 ? "s" : ""} à créer
          </Typography>
          <Typography variant="body2">
            <strong>{pointsCount}</strong> point
            {pointsCount !== 1 ? "s" : ""} à créer
          </Typography>
          {categories.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Catégories :
              </Typography>
              {categories.map((cat) => (
                <Typography
                  key={cat}
                  variant="body2"
                  sx={{ pl: 1, color: "text.secondary" }}
                >
                  {cat}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Annuler</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={annotationsCount === 0}
        >
          Confirmer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
