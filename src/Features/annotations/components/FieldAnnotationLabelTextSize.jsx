import { Box, Typography, Button } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import InputNumberOnBlur from "Features/annotations/components/InputNumberOnBlur";

import { numberInputSx } from "Features/annotations/constants/fieldSx";
import {
  DEFAULT_ANNOTATION_LABEL_FONT_SIZE,
  getAnnotationLabelFontSize,
  hasOwnLabelFontSizeValue,
  LABEL_FONT_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationLabelDisplay";

// strings

const titleS = "Taille du texte";
const unitS = "pt";
const inheritedS = "Hérité du modèle";
const lockedS = "Verrouillé par le modèle";
const resetS = "Réinit.";

// Text size of an annotation's label chip (Etiquette tab), in page pt: the
// chip is always fixed relative to the base map's print zone (see
// getAnnotationLabelFixedSizeConfig). Unset = inherited from the template
// (read-time); legacy S / M / L sizes are resolved by
// getAnnotationLabelFontSize.
export default function FieldAnnotationLabelTextSize({
  annotation,
  overrideFields,
}) {
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const fontSize = getAnnotationLabelFontSize(annotation);
  const isOwn = hasOwnLabelFontSizeValue(annotation);
  const locked =
    Array.isArray(overrideFields) &&
    LABEL_FONT_SIZE_FIELDS.some((f) => overrideFields.includes(f));

  // handlers

  async function update(updates) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, ...updates });
  }

  function handleFontSizeChange(raw) {
    const parsed =
      raw === "" ? DEFAULT_ANNOTATION_LABEL_FONT_SIZE : Number(raw);
    update({
      labelFontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_ANNOTATION_LABEL_FONT_SIZE,
    });
  }

  function handleReset() {
    update({ labelFontSize: null });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
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
          <InputNumberOnBlur
            value={fontSize}
            onCommit={handleFontSizeChange}
            inputProps={{ min: 1, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                {unitS}
              </Typography>
            }
            sx={{
              ...numberInputSx,
              ...(locked && { opacity: 0.5, pointerEvents: "none" }),
            }}
          />
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
