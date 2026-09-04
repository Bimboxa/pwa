import {
  Box,
  Typography,
  Button,
  InputBase,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationLabelSizeConfig, {
  hasOwnLabelSizeValue,
  DEFAULT_LABEL_FONT_SIZE_PT,
  LABEL_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationLabelSizeConfig";
import { FREE_TEXT_PAGE_FORMATS } from "Features/annotations/constants/freeTextConstants";

// strings

const titleS = "Taille fixe";
const fontSizeS = "Taille du texte";
const pageFormatS = "Format de la page";
const inheritedS = "Hérité du modèle";
const lockedS = "Verrouillé par le modèle";
const resetS = "Réinit.";

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: "0.7rem",
  },
};

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

// Per-annotation "Taille fixe" of a standalone LABEL: off = screen-constant
// chip (historical), on = FREE_TEXT display rules (map-fixed, text size in
// page points for an A4/A3 page). Unset = inherited from the template
// (read-time), see getAnnotationLabelSizeConfig.
export default function FieldAnnotationLabelSize({
  annotation,
  overrideFields,
}) {
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const { isFixedSize, fontSize, pageFormat } =
    getAnnotationLabelSizeConfig(annotation);
  const isOwn = hasOwnLabelSizeValue(annotation);
  const locked =
    Array.isArray(overrideFields) &&
    LABEL_SIZE_FIELDS.some((f) => overrideFields.includes(f));

  // handlers

  async function update(updates) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, ...updates });
  }

  // `width` changes unit with the mode (screen px ↔ page pt): back to auto
  // width on every mode switch so the chip never jumps to a foreign size.
  function handleFixedSizeChange(e) {
    update({ isFixedSize: e.target.checked, width: null });
  }

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_LABEL_FONT_SIZE_PT : Number(raw);
    update({
      fontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_LABEL_FONT_SIZE_PT,
    });
  }

  function handlePageFormatChange(e, next) {
    if (next !== null && next !== pageFormat) update({ pageFormat: next });
  }

  function handleReset() {
    update({ isFixedSize: null, fontSize: null, pageFormat: null, width: null });
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

        {isFixedSize && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              ...(locked && { opacity: 0.5, pointerEvents: "none" }),
            }}
          >
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

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {pageFormatS}
              </Typography>
              <ToggleButtonGroup
                value={pageFormat}
                exclusive
                onChange={handlePageFormatChange}
                size="small"
                sx={toggleGroupSx}
              >
                {FREE_TEXT_PAGE_FORMATS.map((o) => (
                  <ToggleButton key={o.key} value={o.key}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Box>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
