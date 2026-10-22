import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import purgeDeletedAnnotationsService from "Features/annotations/services/purgeDeletedAnnotationsService";

// Confirmation dialog of « Nettoyer »: a dry run of the purge announces what
// will be hard-deleted in the current scope (deleted annotations, orphan
// points); « Confirmer » runs the real purge and the dialog reports the
// result. onKeyDown stops the propagation so the toolbar hotkeys stay quiet
// while the dialog is open.
export default function DialogClean({ open, onClose }) {
  // strings

  const titleS = "Nettoyer les annotations supprimées";
  const cancelS = "Annuler";
  const confirmS = "Confirmer";
  const closeS = "Fermer";
  const computingS = "Analyse en cours…";
  const nothingS = "Rien à nettoyer dans ce scope.";
  const irreversibleS = "Action irréversible.";

  // data

  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  // idle (dry run pending) → ready → running → done
  const [step, setStep] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  // helpers

  // "3 annotations supprimées" / "1 annotation supprimée": every word of the
  // label takes the plural mark.
  const plural = (n, words) =>
    `${n} ${words
      .split(" ")
      .map((w) => (n > 1 ? `${w}s` : w))
      .join(" ")}`;
  const hasWork =
    (preview?.purgedAnnotations ?? 0) > 0 ||
    (preview?.purgedPoints ?? 0) > 0 ||
    (preview?.purgedMeshPaints ?? 0) > 0 ||
    (preview?.healedPoints ?? 0) > 0;

  let messageS = computingS;
  if (step === "done" && result) {
    messageS =
      `Nettoyage terminé : ${plural(result.purgedAnnotations, "annotation")} et ` +
      `${plural(result.purgedPoints, "point")} supprimés.` +
      (result.healedPoints
        ? ` ${plural(result.healedPoints, "point")} réparé${result.healedPoints > 1 ? "s" : ""}.`
        : "");
  } else if (preview) {
    messageS = hasWork
      ? `${plural(preview.purgedAnnotations, "annotation supprimée")} et ` +
        `${plural(preview.purgedPoints, "point orphelin")} seront purgés ` +
        `définitivement du scope courant.` +
        (preview.healedPoints
          ? ` ${plural(preview.healedPoints, "point")} encore utilisé${preview.healedPoints > 1 ? "s" : ""} ${preview.healedPoints > 1 ? "seront réparés" : "sera réparé"}.`
          : "") +
        ` ${irreversibleS}`
      : nothingS;
  }

  // effects

  useEffect(() => {
    if (!open || !projectId || !scopeId) return;
    let cancelled = false;
    setStep("idle");
    setPreview(null);
    setResult(null);
    purgeDeletedAnnotationsService({ projectId, scopeId, dryRun: true })
      .then((res) => {
        if (cancelled) return;
        setPreview(res);
        setStep("ready");
      })
      .catch((e) => {
        console.error("[DialogClean] dry run failed", e);
        if (!cancelled) onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, scopeId]);

  // handlers

  async function handleConfirm() {
    if (!projectId || !scopeId) return;
    setStep("running");
    try {
      const res = await purgeDeletedAnnotationsService({ projectId, scopeId });
      // Healed (un-tombstoned) points change no row count and no indexed
      // field, so the reactivity contract (scoped counts + _dbWriteTick) can
      // miss them — force a re-read so repaired annotations reappear at once.
      if (res.healedPoints > 0) dispatch(triggerAnnotationsUpdate());
      setResult(res);
      setStep("done");
    } catch (e) {
      console.error("[DialogClean] purge failed", e);
      setStep("ready");
    }
  }

  // render

  if (!open) return null;

  const running = step === "running";
  const done = step === "done";

  return (
    <Dialog
      open={open}
      onClose={running ? undefined : onClose}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color={done ? "success.main" : undefined}>
          {messageS}
        </Typography>
      </DialogContent>
      <DialogActions>
        {done ? (
          <Button onClick={onClose} variant="contained" autoFocus>
            {closeS}
          </Button>
        ) : (
          <>
            <Button onClick={onClose} variant="outlined" disabled={running}>
              {cancelS}
            </Button>
            <Button
              onClick={handleConfirm}
              color="error"
              variant="contained"
              disabled={step !== "ready" || !hasWork}
              startIcon={
                running ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
              autoFocus
            >
              {confirmS}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
