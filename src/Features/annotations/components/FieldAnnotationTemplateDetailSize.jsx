import { Box, Typography, Button, IconButton, InputBase } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationDetailSizeConfig, {
  DEFAULT_DETAIL_FONT_SIZE_PT,
  DETAIL_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationDetailSizeConfig";

// strings

const fontSizeS = "Taille du texte";
const hintS =
  "La pastille est fixe par rapport au plan et dimensionnée par son texte, taille en points de la zone d'impression du fond de plan.";
const lockTitleS = "Appliquer aux pastilles déjà créées";
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

// Template-level text size of the DETAIL bubbles, in page points of the base
// map's print zone. Unset = app default (12pt). The value is a read-time
// default for the annotations without their own value; the padlock forces it
// on every one.
export default function FieldAnnotationTemplateDetailSize({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
}) {
  // helpers

  const { fontSize } = getAnnotationDetailSizeConfig(annotationTemplate);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    DETAIL_SIZE_FIELDS.every((f) => overrideFields.includes(f));

  // handlers

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_DETAIL_FONT_SIZE_PT : Number(raw);
    onChange({
      ...annotationTemplate,
      fontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_DETAIL_FONT_SIZE_PT,
    });
  }

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !DETAIL_SIZE_FIELDS.includes(f))
      : Array.from(new Set([...current, ...DETAIL_SIZE_FIELDS]));
    onOverrideFieldsChange(next);
  }

  function handleReset() {
    onChange({ ...annotationTemplate, fontSize: null });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {fontSizeS}
          </Typography>
          <InputBase
            type="number"
            value={fontSize ?? ""}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                pt
              </Typography>
            }
            sx={numberInputSx}
          />
          <Button size="small" onClick={handleReset}>
            {resetS}
          </Button>
          {showOverrides && (
            <IconButton
              size="small"
              onClick={handleToggleGlobalOverride}
              title={lockTitleS}
              sx={{ color: allLocked ? "primary.main" : "text.disabled" }}
            >
              {allLocked ? (
                <LockIcon fontSize="small" />
              ) : (
                <LockOpenIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
      </Box>
    </WhiteSectionGeneric>
  );
}
