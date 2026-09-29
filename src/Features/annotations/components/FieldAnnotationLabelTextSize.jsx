import {
  Box,
  Typography,
  Button,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationLabelFixedSizeConfig, {
  hasOwnLabelFixedSizeValue,
  LABEL_FIXED_SIZE_FIELDS,
} from "Features/annotations/utils/getAnnotationLabelFixedSizeConfig";

// strings

const titleS = "Taille du texte";
const fixedSizeS = "Fixe / zone d'impression";
const fixedSizeTitleS =
  "Activé : taille fixe par rapport à la zone d'impression. Désactivé : taille fixe à l'écran.";
const inheritedS = "Hérité du modèle";
const lockedS = "Verrouillé par le modèle";
const resetS = "Réinit.";

const FONT_SIZE_OPTIONS = [
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
];

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1.5,
    py: 0.25,
    fontSize: "0.7rem",
  },
};

// Text size of an annotation's label chip (Etiquette tab): S/M/L preset +
// size mode. Fixed mode (default) = the chip is fixed relative to the base
// map's print zone (sizes in page pt); off = screen-constant chip (screen px).
// The mode is inherited from the template when unset (read-time), see
// getAnnotationLabelFixedSizeConfig.
export default function FieldAnnotationLabelTextSize({
  annotation,
  overrideFields,
}) {
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const fontSize = annotation?.labelFontSize ?? "M";
  const { isFixedSize } = getAnnotationLabelFixedSizeConfig(annotation);
  const isOwn = hasOwnLabelFixedSizeValue(annotation);
  const locked =
    Array.isArray(overrideFields) &&
    LABEL_FIXED_SIZE_FIELDS.some((f) => overrideFields.includes(f));

  // handlers

  async function update(updates) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, ...updates });
  }

  function handleFontSizeChange(e, value) {
    if (value) update({ labelFontSize: value });
  }

  function handleFixedSizeChange(e) {
    update({ labelIsFixedSize: e.target.checked });
  }

  function handleReset() {
    update({ labelIsFixedSize: null });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={fontSize}
            onChange={handleFontSizeChange}
            sx={toggleGroupSx}
          >
            {FONT_SIZE_OPTIONS.map(({ value, label }) => (
              <ToggleButton key={value} value={value}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            title={fixedSizeTitleS}
            sx={{ flex: 1, ...(locked && { opacity: 0.5 }) }}
          >
            {fixedSizeS}
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
          <Switch
            size="small"
            checked={isFixedSize}
            onChange={handleFixedSizeChange}
            disabled={locked}
          />
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
