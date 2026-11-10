import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";
import { setHollowOutExcludedTemplateIds } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useHollowOut3dCandidates from "../hooks/useHollowOut3dCandidates";

import PreviewHollowOutAnnotation from "./PreviewHollowOutAnnotation";
import TemplateSwitchRowHollowOut from "./TemplateSwitchRowHollowOut";

import addAnnotationSubtractions from "../services/addAnnotationSubtractions";
import getAnnotationColor from "../utils/getAnnotationColor";
import getHollowOut3dPreviewPieces, {
  getFootprintOverlapPieces,
} from "../utils/getHollowOut3dPreviewPieces";
import getHollowOutTemplateGroups, {
  getHollowOutGroupKey,
} from "../utils/getHollowOutTemplateGroups";

// « Évider » in the 3D editor: the annotations of the scene whose solid cuts
// into the selected one are offered as SUBTRACTIONS (relAnnotationSubtractions:
// live 3D carve, the geometry of the host is not rewritten — unlike the 2D
// dialog, DialogHollowOutAnnotation). One switch per annotation template; the
// overview is the projection of the host on its own base map minus the
// footprints of the subtractions on that base map, each removed zone tinted in
// the colour of its subtraction. Nothing is written until
// « Évider » is confirmed. The switched-off templates are remembered for the
// session (shared with the 2D dialog).
export default function DialogHollowOutAnnotation3d({
  annotationId,
  annotations,
  onClose,
}) {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const excludedTemplateIds = useSelector(
    (s) => s.mapEditor.hollowOutExcludedTemplateIds
  );
  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const {
    loading,
    host,
    hostFootprint,
    candidates,
    footprintById,
    existingFootprints,
  } = useHollowOut3dCandidates({ annotationId, annotations });

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  const accentColor = getAnnotationColor(host) || "#6366F1";

  const groups = useMemo(
    () => getHollowOutTemplateGroups(candidates, annotationTemplates),
    [candidates, annotationTemplates]
  );

  const enabledCandidates = useMemo(() => {
    const excluded = new Set(excludedTemplateIds);
    return candidates.filter((a) => !excluded.has(getHollowOutGroupKey(a)));
  }, [candidates, excludedTemplateIds]);

  const preview = useMemo(
    () =>
      getHollowOut3dPreviewPieces({
        hostFootprint,
        cutterFootprints: [
          ...existingFootprints.map((entry) => entry.footprint),
          ...enabledCandidates.map((a) => footprintById.get(a.id)),
        ],
      }),
    [hostFootprint, existingFootprints, enabledCandidates, footprintById]
  );

  // The removed zones, tinted in the colour of each subtraction: the overview
  // never reads as an empty frame, even when the footprints cover the whole
  // projection of the host.
  const overlays = useMemo(() => {
    const entries = [
      ...existingFootprints,
      ...enabledCandidates.map((annotation) => ({
        annotation,
        footprint: footprintById.get(annotation.id),
      })),
    ];
    return entries
      .map(({ annotation, footprint }) => ({
        id: annotation.id,
        color: getAnnotationColor(annotation),
        pieces: getFootprintOverlapPieces(hostFootprint, footprint),
      }))
      .filter((overlay) => overlay.pieces.length > 0);
  }, [hostFootprint, existingFootprints, enabledCandidates, footprintById]);

  // The host as a flat POLYGON on its own base map: what the overview draws
  // (frame + dashed outline of the un-carved projection).
  const previewAnnotation = useMemo(() => {
    const outline = preview?.outline;
    if (!host || !outline?.length) return null;
    const color = getAnnotationColor(host);
    return {
      ...host,
      type: "POLYGON",
      closeLine: true,
      fillColor: host.fillColor ?? color,
      isMesh3d: false,
      mesh3d: undefined,
      shape3D: undefined,
      profileLines: undefined,
      points: outline[0].points,
      cuts: [
        ...outline[0].cuts,
        ...outline
          .slice(1)
          .flatMap((piece) => [{ points: piece.points }, ...piece.cuts]),
      ],
    };
  }, [host, preview]);

  const canConfirm = !loading && enabledCandidates.length > 0;

  let helperText = null;
  if (loading) {
    helperText = "Recherche des annotations qui intersectent en 3D…";
  } else if (candidates.length === 0) {
    helperText = "Aucune annotation n'intersecte cette annotation en 3D.";
  } else if (enabledCandidates.length === 0) {
    helperText = "Tous les modèles sont désactivés : rien à évider.";
  } else if (preview?.consumed) {
    helperText =
      "Les soustractions recouvrent toute la projection de l'annotation sur son fond de plan (elles peuvent ne l'entamer que sur une partie de son épaisseur).";
  } else if (!preview) {
    helperText =
      "Aperçu indisponible : l'annotation est perpendiculaire à son fond de plan.";
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
      await addAnnotationSubtractions({
        projectId,
        pairs: enabledCandidates.map((a) => ({
          sourceAnnotationId: annotationId,
          targetAnnotationId: a.id,
        })),
      });
      dispatch(triggerAnnotationsUpdate());
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      // Keys typed in the dialog must not reach the editor's window keydown
      // listeners.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DialogTitle>Évider</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {loading && (
            <Box
              sx={{
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={28} />
            </Box>
          )}

          {!loading && previewAnnotation && (
            <PreviewHollowOutAnnotation
              annotation={previewAnnotation}
              pieces={preview.pieces}
              overlays={overlays}
            />
          )}

          {helperText && (
            <Typography variant="caption" color="text.secondary">
              {helperText}
            </Typography>
          )}

          {groups.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                Annotations à soustraire
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
