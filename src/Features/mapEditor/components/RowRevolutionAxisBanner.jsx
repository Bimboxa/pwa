import { useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  RotateRight,
  Visibility,
  VisibilityOff,
  Close,
} from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";
import getRevolutionAxisDependents from "Features/annotations/services/getRevolutionAxisDependents";

// One revolution axis POSED on the elevation currently shown in the 2D editor
// (a REVOLUTION_AXIS_PLACEMENT), displayed as a coloured band in the "Outils de
// dessin" section — in place of the axis picker, which has done its job once an
// axis sits on this base map.
//
// Both actions target the PLACEMENT, not the axis itself: the axis lives on the
// plan and may be posed on several elevations, each with its own visibility.
// Deleting removes it from THIS elevation only (the base map keeps the pose it
// was given).
export default function RowRevolutionAxisBanner({ placement, axis }) {
  // data

  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();

  // state

  const [confirmArcs, setConfirmArcs] = useState(null);
  const [busy, setBusy] = useState(false);

  // helpers

  const isHidden = Boolean(placement.hidden);
  const label = axis?.label ?? placement.label ?? "Axe";

  // handlers

  async function handleToggleHidden() {
    await updateAnnotation({ id: placement.id, hidden: !isHidden });
  }

  async function handleDeleteClick() {
    // Arcs of THIS base map bound to the axis: without the placement they lose
    // their lathe axis and fall back to plain walls, so ask first.
    const { arcs } = await getRevolutionAxisDependents({
      axisId: placement.revolutionAxisId,
      baseMapId: placement.baseMapId,
    });
    if (arcs.length > 0) setConfirmArcs(arcs);
    else await runDelete();
  }

  async function runDelete() {
    setBusy(true);
    try {
      await deleteAnnotation(placement.id);
    } finally {
      setBusy(false);
      setConfirmArcs(null);
    }
  }

  // render

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 3,
          pr: 0.5,
          py: 0.5,
          bgcolor: "secondary.main",
          color: "common.white",
          opacity: isHidden ? 0.55 : 1,
        }}
      >
        <RotateRight sx={{ fontSize: 18, mr: 0.5 }} />
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: 600, userSelect: "none" }}
        >
          {label}
        </Typography>

        <Tooltip
          title={
            isHidden ? "Afficher sur l'élévation" : "Masquer de l'élévation"
          }
          arrow
        >
          <IconButton
            size="small"
            onClick={handleToggleHidden}
            sx={{
              color: "common.white",
              "&:hover": { bgcolor: "rgba(255,255,255,0.18)" },
            }}
          >
            {isHidden ? (
              <VisibilityOff sx={{ fontSize: 16 }} />
            ) : (
              <Visibility sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="Retirer l'axe de cette élévation" arrow>
          <IconButton
            size="small"
            disabled={busy}
            onClick={handleDeleteClick}
            sx={{
              color: "common.white",
              "&:hover": { bgcolor: "rgba(255,255,255,0.18)" },
            }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Dialog
        open={Boolean(confirmArcs)}
        onClose={() => setConfirmArcs(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{`Retirer « ${label} » de cette élévation ?`}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmArcs?.length === 1
              ? "1 annotation de ce fond de plan tourne autour de cet axe."
              : `${confirmArcs?.length ?? 0} annotations de ce fond de plan tournent autour de cet axe.`}
            {
              " Elles perdront leur révolution en 3D. L'axe lui-même est conservé sur la vue en plan, et le fond de plan garde sa position."
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmArcs(null)}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={busy}
            onClick={runDelete}
          >
            Retirer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
