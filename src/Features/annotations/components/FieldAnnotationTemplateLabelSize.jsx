import {
  Box,
  Typography,
  Button,
  IconButton,
  InputBase,
  Switch,
} from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationLabelSizeConfig, {
  DEFAULT_LABEL_FONT_SIZE_PT,
  LABEL_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationLabelSizeConfig";

// strings

const titleS = "Taille fixe";
const fontSizeS = "Taille du texte";
const hintS =
  "Fixe par rapport au plan (zoome avec le fond de plan), taille en points de la zone d'impression du fond de plan.";
const lockTitleS = "Appliquer aux étiquettes déjà créées";
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

// Template-level "Taille fixe" of standalone LABEL annotations: off = the
// historical screen-constant chip; on = FREE_TEXT display rules (map-fixed,
// text size in page points of the print zone). Unset = app default (on,
// 14pt, A4). The value is a read-time default for the annotations without
// their own value; the padlock forces it on every one.
export default function FieldAnnotationTemplateLabelSize({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
}) {
  // helpers

  const { isFixedSize, fontSize } =
    getAnnotationLabelSizeConfig(annotationTemplate);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    LABEL_SIZE_FIELDS.every((f) => overrideFields.includes(f));

  // handlers

  function handleFixedSizeChange(e) {
    onChange({ ...annotationTemplate, isFixedSize: e.target.checked });
  }

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_LABEL_FONT_SIZE_PT : Number(raw);
    onChange({
      ...annotationTemplate,
      fontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_LABEL_FONT_SIZE_PT,
    });
  }

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !LABEL_SIZE_FIELDS.includes(f))
      : Array.from(new Set([...current, ...LABEL_SIZE_FIELDS]));
    onOverrideFieldsChange(next);
  }

  function handleReset() {
    onChange({
      ...annotationTemplate,
      isFixedSize: null,
      fontSize: null,
      pageFormat: null,
    });
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
            checked={isFixedSize}
            onChange={handleFixedSizeChange}
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

        {isFixedSize && (
          <>
            <Typography variant="caption" color="text.secondary">
              {hintS}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
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
            </Box>
          </>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
