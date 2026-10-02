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
  Switch,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import useCommitHollowOut from "../hooks/useCommitHollowOut";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useVisibleAnnotations from "Features/mapEditor/hooks/useVisibleAnnotations";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import PreviewHollowOutAnnotation from "./PreviewHollowOutAnnotation";

import avoidVisibleAnnotationsService from "../services/avoidVisibleAnnotationsService";
import getAnnotationColor from "../utils/getAnnotationColor";
import getHollowOutCandidates from "../utils/getHollowOutCandidates";
import {
  TEMPLATELESS_LABEL,
  TEMPLATELESS_TEMPLATE_ID,
  isTemplatelessAnnotation,
} from "../utils/templatelessAnnotations";

// Group key of a cutting annotation: its template, or the template-less
// sentinel (same key as the solo / eye filters).
const getGroupKey = (annotation) =>
  annotation?.annotationTemplateId ?? TEMPLATELESS_TEMPLATE_ID;

// One row per annotation template taking part in the carve: icon + label +
// count + switch (off = the annotations of that template do not cut).
function TemplateSwitchRow({ group, spriteImage, checked, onChange }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        pl: 0.5,
        py: 0.25,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          mr: 1,
          flexShrink: 0,
          opacity: checked ? 1 : 0.4,
          filter: checked ? "none" : "grayscale(100%)",
        }}
      >
        <AnnotationTemplateIcon
          template={group.iconSource}
          size={18}
          spriteImage={spriteImage}
        />
      </Box>
      <Typography
        variant="body2"
        color={checked ? "text.primary" : "text.disabled"}
        sx={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          userSelect: "none",
        }}
      >
        {group.label}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mx: 1, flexShrink: 0 }}
      >
        {group.count}
      </Typography>
      <Switch
        size="small"
        checked={checked}
        onChange={(e) => onChange(group.key, e.target.checked)}
      />
    </Box>
  );
}

// "Evider" confirmation: overview of the carved POLYGON + the annotation
// templates whose annotations would cut it, each with a switch. Opened by the
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

  const candidates = useMemo(
    () =>
      annotation
        ? getHollowOutCandidates({ annotation, visibleAnnotations, baseMap })
        : [],
    [annotation, visibleAnnotations, baseMap]
  );

  const groups = useMemo(() => {
    const templateById = new Map(
      (annotationTemplates ?? []).map((t) => [t.id, t])
    );
    const groupByKey = new Map();
    for (const candidate of candidates) {
      const key = getGroupKey(candidate);
      let group = groupByKey.get(key);
      if (!group) {
        const template = templateById.get(key);
        group = {
          key,
          label:
            template?.label ??
            (isTemplatelessAnnotation(candidate)
              ? TEMPLATELESS_LABEL
              : candidate.label || "-?"),
          iconSource: template ?? candidate,
          count: 0,
        };
        groupByKey.set(key, group);
      }
      group.count += 1;
    }
    return [...groupByKey.values()].sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );
  }, [candidates, annotationTemplates]);

  const enabledCandidates = useMemo(() => {
    const excluded = new Set(excludedTemplateIds);
    return candidates.filter((a) => !excluded.has(getGroupKey(a)));
  }, [candidates, excludedTemplateIds]);

  const carved = useMemo(() => {
    if (!annotation || enabledCandidates.length === 0) return null;
    return avoidVisibleAnnotationsService({
      drawnShape: { points: annotation.points, cuts: annotation.cuts ?? [] },
      candidates: enabledCandidates,
      baseMap,
    });
  }, [annotation, enabledCandidates, baseMap]);

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
    helperText = "Aucune annotation visible ne recoupe ce polygone.";
  } else if (enabledCandidates.length === 0) {
    helperText = "Tous les modèles sont désactivés : rien à évider.";
  } else if (consumed) {
    helperText =
      "Le polygone serait entièrement évidé : désactivez au moins un modèle.";
  } else if (pieces.length > 1) {
    helperText = `Le polygone sera divisé en ${pieces.length} annotations.`;
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
          <PreviewHollowOutAnnotation annotation={annotation} pieces={pieces} />

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
                  <TemplateSwitchRow
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
