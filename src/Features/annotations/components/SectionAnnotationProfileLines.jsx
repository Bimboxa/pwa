import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import {
  selectSelectedItem,
  setSubSelection,
} from "Features/selection/selectionSlice";

import { Box, Button, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import mirrorProfileLineService, {
  MIRROR_ERROR_MESSAGES,
} from "Features/elevation/services/mirrorProfileLineService";
import useDeleteProfileLine from "Features/annotations/hooks/useDeleteProfileLine";

// « Profil » section of the annotation properties panel: the inline
// profiles of a POLYLINE (annotation.profileLines — « Ajouter un profil »),
// each with « Inverser » (swap sides of the guide line,
// mirrorProfileLineService) and « Supprimer » (useDeleteProfileLine, the
// polyline comes back flat; Ctrl+Z restores). Self-hiding without profile.
export default function SectionAnnotationProfileLines({ annotation }) {
  const dispatch = useDispatch();
  const deleteProfileLine = useDeleteProfileLine();
  const selectedItem = useSelector(selectSelectedItem);

  // strings

  const titleS = "Profil";
  const descriptionS =
    "Section extrudée le long de la ligne. Inverser la bascule de l'autre côté de la ligne guide.";
  const labelS = (i, n) => `Profil ${i + 1} (${n} points)`;
  const sourceS = (label) => `Depuis « ${label} »`;
  const mirrorS = "Inverser";
  const deleteS = "Supprimer";
  const mirroredS = "Profil inversé (Ctrl+Z pour annuler)";
  const mirrorFailedS = "Inversion impossible";
  const deletedS = "Profil supprimé (Ctrl+Z pour annuler)";
  const deleteFailedS = "Suppression impossible";

  // data

  const lines = (annotation?.profileLines ?? [])
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => (line?.points?.length ?? 0) >= 2);
  const sourceIds = lines
    .map(({ line }) => line.sourceAnnotationId)
    .filter(Boolean);
  const sources = useLiveQuery(
    () => (sourceIds.length ? db.annotations.bulkGet(sourceIds) : []),
    [sourceIds.join("|")]
  );
  const sourceLabelOf = (id) => {
    const src = (sources ?? []).find((a) => a?.id === id);
    return src && !src.deletedAt ? src.label || "profil sans nom" : null;
  };

  // state

  const [busy, setBusy] = useState(false);

  // handlers

  async function handleMirror(index) {
    if (!annotation?.id || busy) return;
    setBusy(true);
    try {
      const result = await mirrorProfileLineService({
        annotationId: annotation.id,
        index,
        dispatch,
      });
      if (result?.error) {
        dispatch(
          setToaster({
            message: MIRROR_ERROR_MESSAGES[result.error] ?? mirrorFailedS,
            severity: "warning",
          })
        );
        return;
      }
      dispatch(setToaster({ message: mirroredS, severity: "success" }));
    } catch (e) {
      console.error("[profileLines] mirror", e);
      dispatch(setToaster({ message: mirrorFailedS, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(index) {
    if (!annotation?.id || busy) return;
    setBusy(true);
    try {
      await withUndoGroup(() =>
        deleteProfileLine({ annotationId: annotation.id, index })
      );
      // A sub-selected profile line of this annotation no longer exists (or
      // its index shifted): drop the sub-selection.
      if (
        String(selectedItem?.partId || "").startsWith(
          `${annotation.id}::PROFILE_LINE::`
        )
      ) {
        dispatch(setSubSelection({ partId: null, partType: null }));
      }
      dispatch(triggerAnnotationsUpdate());
      dispatch(setToaster({ message: deletedS, severity: "success" }));
    } catch (e) {
      console.error("[profileLines] delete", e);
      dispatch(setToaster({ message: deleteFailedS, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  if (!annotation?.id || !lines.length) return null;

  return (
    <Box
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {titleS}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {descriptionS}
      </Typography>
      {lines.map(({ line, index }) => {
        const sourceLabel = line.sourceAnnotationId
          ? sourceLabelOf(line.sourceAnnotationId)
          : null;
        return (
          <Box
            key={index}
            sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
          >
            <Typography variant="body2">
              {labelS(index, line.points.length)}
            </Typography>
            {sourceLabel && (
              <Typography variant="caption" color="text.secondary">
                {sourceS(sourceLabel)}
              </Typography>
            )}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SwapHorizIcon />}
                onClick={() => handleMirror(index)}
                disabled={busy}
                sx={{ textTransform: "none" }}
              >
                {mirrorS}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => handleDelete(index)}
                disabled={busy}
                sx={{ textTransform: "none" }}
              >
                {deleteS}
              </Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
