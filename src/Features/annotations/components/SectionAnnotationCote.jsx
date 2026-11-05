import { Box, Button, Switch, Typography } from "@mui/material";
import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { COTE_FIELDS } from "Features/annotations/constants/coteFields";
import {
  hasActiveRulerLabelOffsets,
  isZeroLabelOffset,
} from "Features/annotations/utils/getRulerSegmentKey";

import FieldAnnotationTemplateCote from "./FieldAnnotationTemplateCote";

// Cote settings of ONE selected COTE / RULER annotation (unit, decimals,
// offset, font size, unit label, and for a ruler the total line / the label
// prefixes): the template popover reused at row level — the edits land on
// this annotation only. A template padlock on the cote fields wins over the
// row (getAnnotationPropsFromAnnotationTemplateProps), so the field is shown
// disabled then.
//
// « Réinitialiser la position de l'étiquette / des étiquettes » drops the
// 3D value-card offsets (dragged and rendered in the 3D editor only): a
// cote's `coteLabelOffset`, a ruler's per-segment `rulerLabelOffsets` —
// every card goes back onto its cote. For a cote it also drops
// `coteLabelOffset2d`, the 2D label placement of the "Étiquette" style.
//
// « Afficher en 3D »: 3D visibility is template-owned (template.showIn3d), so
// a row WITHOUT a template carries its own `showIn3d` (false by default) —
// the switch is shown for those rows only. Rows drawn from the 3D viewer
// (isDrawnIn3d) are always visible there: no switch.
export default function SectionAnnotationCote({ annotation, overrideFields }) {
  // strings

  const titleS = annotation?.type === "RULER" ? "Cotes de la règle" : "Cote";
  const lockedS = "Réglages verrouillés par le modèle";
  const resetS =
    annotation?.type === "RULER"
      ? "Réinitialiser la position des étiquettes"
      : "Réinitialiser la position de l'étiquette";
  const resetHelperS =
    annotation?.type === "RULER"
      ? "Replace chaque étiquette déplacée en 3D sur sa cote."
      : "Replace l'étiquette déplacée (2D ou 3D) à sa position par défaut.";
  const showIn3dS = "Afficher en 3D";

  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const isRuler = annotation?.type === "RULER";
  const lockedByTemplate =
    Array.isArray(overrideFields) &&
    COTE_FIELDS.every((f) => overrideFields.includes(f));
  const showShowIn3dSwitch =
    !annotation?.annotationTemplateId && !annotation?.isDrawnIn3d;
  const hasLabelOffsets = isRuler
    ? hasActiveRulerLabelOffsets(annotation)
    : !isZeroLabelOffset(annotation?.coteLabelOffset) ||
      Boolean(annotation?.coteLabelOffset2d);

  // handlers

  // The popover hands back the whole object it was given (the merged row,
  // resolved points included): keep the cote fields that changed only.
  async function handleChange(next) {
    if (!annotation?.id || !next) return;
    const patch = {};
    COTE_FIELDS.forEach((field) => {
      if (next[field] !== annotation[field]) patch[field] = next[field];
    });
    if (!Object.keys(patch).length) return;
    await updateAnnotation({ id: annotation.id, ...patch });
  }

  async function handleShowIn3dChange(e, checked) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, showIn3d: checked });
  }

  async function handleResetLabelOffsets() {
    if (!annotation?.id) return;
    await updateAnnotation({
      id: annotation.id,
      ...(isRuler
        ? { rulerLabelOffsets: null }
        : { coteLabelOffset: null, coteLabelOffset2d: null }),
    });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
        {titleS}
      </Typography>
      <Box
        sx={{
          ...(lockedByTemplate ? { pointerEvents: "none", opacity: 0.5 } : {}),
        }}
      >
        <FieldAnnotationTemplateCote
          annotationTemplate={annotation}
          onChange={handleChange}
          label={isRuler ? "Cotes" : "Cote"}
          showTotalOption={isRuler}
          showLabelOption={isRuler}
          showStyleOption={!isRuler}
        />
      </Box>
      {lockedByTemplate && (
        <Typography variant="caption" color="text.secondary">
          {lockedS}
        </Typography>
      )}
      {showShowIn3dSwitch && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mt: 1,
          }}
        >
          <Typography variant="body2">{showIn3dS}</Typography>
          <Switch
            size="small"
            checked={Boolean(annotation?.showIn3d)}
            onChange={handleShowIn3dChange}
          />
        </Box>
      )}
      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FilterCenterFocusIcon />}
          disabled={!hasLabelOffsets}
          onClick={handleResetLabelOffsets}
        >
          {resetS}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
        >
          {resetHelperS}
        </Typography>
      </Box>
    </WhiteSectionGeneric>
  );
}
