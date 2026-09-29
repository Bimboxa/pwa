import { Box, Typography, Button, InputBase } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationDetailSizeConfig, {
  hasOwnDetailSizeValue,
  DEFAULT_DETAIL_FONT_SIZE_PT,
  DETAIL_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationDetailSizeConfig";

// strings

const fontSizeS = "Taille du texte";
const inheritedS = "Hérité du modèle";
const lockedS = "Verrouillé par le modèle";
const resetS = "Réinit.";

const numberInputSx = {
  width: 64,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  px: 1,
  height: 28,
  fontSize: "0.8rem",
  "& input": { textAlign: "center", p: 0 },
};

// Per-annotation text size of a DETAIL bubble, in page points of the base
// map's print zone — the bubble size derives from it. Unset = inherited from
// the template (read-time), see getAnnotationDetailSizeConfig.
export default function FieldAnnotationDetailSize({
  annotation,
  overrideFields,
}) {
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const { fontSize } = getAnnotationDetailSizeConfig(annotation);
  const isOwn = hasOwnDetailSizeValue(annotation);
  const locked =
    Array.isArray(overrideFields) &&
    DETAIL_SIZE_FIELDS.some((f) => overrideFields.includes(f));

  // handlers

  async function update(updates) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, ...updates });
  }

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_DETAIL_FONT_SIZE_PT : Number(raw);
    update({
      fontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_DETAIL_FONT_SIZE_PT,
    });
  }

  function handleReset() {
    update({ fontSize: null });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {fontSizeS}
        </Typography>
        <InputBase
          type="number"
          value={fontSize ?? ""}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          inputProps={{ min: 1, step: 1 }}
          disabled={locked}
          endAdornment={
            <Typography variant="caption" color="text.secondary">
              pt
            </Typography>
          }
          sx={numberInputSx}
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
    </WhiteSectionGeneric>
  );
}
