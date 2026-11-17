import { Box, Typography, Button, Switch } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationOffsetLineConfig, {
  hasOwnOffsetLineValue,
  isOffsetLineLocked,
} from "Features/annotations/utils/getAnnotationOffsetLineConfig";

import FieldsOffsetLine from "./FieldsOffsetLine";

// strings

const titleS = "Ligne de déport";
const inheritedS = "Hérité du modèle";
const lockedS = "Verrouillé par le modèle";
const resetS = "Réinit.";

// Per-annotation "Ligne de déport" (POLYLINE / POLYGON / STRIP): a line drawn
// parallel to the annotation's main line, with the label along it. Unset keys
// are inherited from the template at read time, see
// getAnnotationOffsetLineConfig; the offset is also draggable on the plan.
export default function FieldAnnotationOffsetLine({
  annotation,
  overrideFields,
}) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const locked = isOffsetLineLocked(overrideFields);
  // Locked: the template's `offsetLine` wins over the row's, as rendered
  // (generic override loop of getAnnotationPropsFromAnnotationTemplateProps).
  const templateOffsetLine = (
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate
  )?.offsetLine;
  const config = getAnnotationOffsetLineConfig(
    locked && templateOffsetLine
      ? { offsetLine: templateOffsetLine }
      : annotation
  );
  const isOwn = !locked && hasOwnOffsetLineValue(annotation);

  // handlers

  // Own keys only: the untouched ones keep following the template.
  async function handleChange(changes) {
    if (!annotation?.id) return;
    await updateAnnotation({
      id: annotation.id,
      offsetLine: { ...(annotation.offsetLine ?? {}), ...changes },
    });
  }

  function handleEnabledChange(e) {
    handleChange({ enabled: e.target.checked });
  }

  async function handleReset() {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, offsetLine: null });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
          <Switch
            size="small"
            checked={config.enabled}
            onChange={handleEnabledChange}
            disabled={locked}
          />
          {locked ? (
            <LockIcon
              fontSize="small"
              titleAccess={lockedS}
              sx={{ color: "text.disabled" }}
            />
          ) : isOwn ? (
            <Button size="small" onClick={handleReset}>
              {resetS}
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {inheritedS}
            </Typography>
          )}
        </Box>

        {config.enabled && (
          <FieldsOffsetLine
            config={config}
            onChange={handleChange}
            disabled={locked}
          />
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
