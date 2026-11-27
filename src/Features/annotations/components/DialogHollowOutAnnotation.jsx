import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setHollowOutExcludedTemplateIds } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useCommitHollowOut from "../hooks/useCommitHollowOut";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useVisibleAnnotations from "Features/mapEditor/hooks/useVisibleAnnotations";

import PreviewHollowOutAnnotation from "./PreviewHollowOutAnnotation";
import TemplateSwitchRowHollowOut from "./TemplateSwitchRowHollowOut";

import avoidVisibleAnnotationsService from "../services/avoidVisibleAnnotationsService";
import getAnnotationColor from "../utils/getAnnotationColor";
import getHollowOutCandidates, {
  HOLLOW_OUT_LINE_TYPES,
} from "../utils/getHollowOutCandidates";
import getHollowOutCutterFootprints, {
  toHollowOutCutter,
} from "../utils/getHollowOutCutterFootprints";
import getHollowOutPolylineCarve from "../utils/getHollowOutPolylineCarve";
import getHollowOutTemplateGroups, {
  getHollowOutGroupKey,
} from "../utils/getHollowOutTemplateGroups";

// "Evider" confirmation: overview of the carved annotation + the annotation
// templates whose annotations would cut it, each with a switch. A POLYGON is
// carved as a contour (avoidVisibleAnnotationsService); a POLYLINE / STRIP has
// its centerline clipped by the same footprints (getHollowOutPolylineCarve),
// each remaining chain becoming a line. Opened by the
// overlay button above the annotation and the "E" shortcut (both set
// mapEditor.hollowOutDialogAnnotationId, see DialogHollowOutAnnotationOutlet);
// nothing is written until "Evider" is confirmed (useCommitHollowOut).
// The switched-off templates are remembered for the session.
export default function DialogHollowOutAnnotation({ annotationId, onClose }) {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const visibleAnnotations = useVisibleAnnotations();
  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const commitHollowOut = useCommitHollowOut();

  const excludedTemplateIds = useSelector(
    (s) => s.mapEditor.hollowOutExcludedTemplateIds
  );

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  const annotation = useMemo(
    () => (visibleAnnotations ?? []).find((a) => a.id === annotationId),
    [visibleAnnotations, annotationId]
  );
  const accentColor = getAnnotationColor(annotation) || "#6366F1";
  const isLine = HOLLOW_OUT_LINE_TYPES.includes(annotation?.type);
  const meterByPx = baseMap?.getMeterByPx?.();

  const candidates = useMemo(
    () =>
      annotation
        ? getHollowOutCandidates({ annotation, visibleAnnotations, baseMap })
        : [],
    [annotation, visibleAnnotations, baseMap]
  );

  const groups = useMemo(
    () => getHollowOutTemplateGroups(candidates, annotationTemplates),
    [candidates, annotationTemplates]
  );

  const enabledCandidates = useMemo(() => {
    const excluded = new Set(excludedTemplateIds);
    return candidates.filter((a) => !excluded.has(getHollowOutGroupKey(a)));
  }, [candidates, excludedTemplateIds]);

  // Footprints of the enabled cutters: what clips a line, and what the
  // preview tints over it (the gaps of a thin line would not read alone).
  const cutterOverlays = useMemo(() => {
    if (!isLine) return null;
    return enabledCandidates.map((candidate) => ({
      id: candidate.id,
      color: getAnnotationColor(candidate),
      pieces: getHollowOutCutterFootprints(candidate, { meterByPx }),
    }));
  }, [isLine, enabledCandidates, meterByPx]);

  const carved = useMemo(() => {
    if (!annotation || enabledCandidates.length === 0) return null;
    if (isLine) {
      return getHollowOutPolylineCarve({
        annotation,
        footprints: cutterOverlays.flatMap((overlay) => overlay.pieces),
      });
    }
    return avoidVisibleAnnotationsService({
      drawnShape: { points: annotation.points, cuts: annotation.cuts ?? [] },
      // A RECTANGLE has no points: it cuts as the polygon of its corners.
      candidates: enabledCandidates.map(toHollowOutCutter),
      baseMap,
    });
  }, [annotation, enabledCandidates, baseMap, isLine, cutterOverlays]);

  const consumed = Boolean(carved?.consumed);
  const pieces = useMemo(() => {
    if (!annotation) return [];
    if (!carved) {
      return [{ points: annotation.points, cuts: annotation.cuts ?? [] }];
    }
    return carved.consumed ? [] : (carved.pieces ?? []);
  }, [annotation, carved]);

  const canConfirm = Boolean(carved) && !consumed && pieces.length > 0;

  let helperText = null;
  if (candidates.length === 0) {
    helperText = isLine
      ? "Aucune annotation visible ne recoupe cette ligne."
      : "Aucune annotation visible ne recoupe ce polygone.";
  } else if (enabledCandidates.length === 0) {
    helperText = "Tous les modèles sont désactivés : rien à évider.";
  } else if (consumed) {
    helperText = isLine
      ? "La ligne serait entièrement évidée : désactivez au moins un modèle."
      : "Le polygone serait entièrement évidé : désactivez au moins un modèle.";
  } else if (pieces.length > 1) {
    helperText = isLine
      ? `La ligne sera divisée en ${pieces.length} annotations.`
      : `Le polygone sera divisé en ${pieces.length} annotations.`;
  }

  // handlers

  function handleToggleGroup(key, checked) {
    const next = new Set(excludedTemplateIds);
    if (checked) next.delete(key);
    else next.add(key);
    dispatch(setHollowOutExcludedTemplateIds([...next]));
  }

  async function handleConfirm() {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await commitHollowOut(annotation, carved);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  // render

  // Not resolved yet (useVisibleAnnotations yields [] while loading). A
  // request whose annotation is no longer selected is dropped by the outlet.
  if (!annotation) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      // Keys typed in the dialog must not reach the map editor's window
      // keydown listener (E, Backspace, arrows...).
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DialogTitle>Évider</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <PreviewHollowOutAnnotation
            annotation={annotation}
            pieces={pieces}
            overlays={cutterOverlays}
            baseMapMeterByPx={meterByPx}
          />

          {helperText && (
            <Typography variant="caption" color="text.secondary">
              {helperText}
            </Typography>
          )}

          {groups.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                Annotations qui découpent
              </Typography>
              <Box sx={{ maxHeight: 240, overflowY: "auto" }}>
                {groups.map((group) => (
                  <TemplateSwitchRowHollowOut
                    key={group.key}
                    group={group}
                    spriteImage={spriteImage}
                    checked={!excludedTemplateIds.includes(group.key)}
                    onChange={handleToggleGroup}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          autoFocus
          onClick={handleConfirm}
          disabled={!canConfirm || busy}
          sx={{ bgcolor: accentColor }}
        >
          Évider
        </Button>
      </DialogActions>
    </Dialog>
  );
}
