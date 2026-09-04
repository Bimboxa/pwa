import {
  Box,
  Typography,
  Button,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getAnnotationLabelStubConfig, {
  hasOwnLabelStubValue,
  LABEL_STUB_FIELDS,
} from "Features/annotations/utils/getAnnotationLabelStubConfig";

// strings

const titleS = "Déport horizontal";
const inheritedS = "Hérité du modèle";
const lockedS = "Verrouillé par le modèle";
const resetS = "Réinit.";

const MODE_OPTIONS = [
  { value: "FIXED", label: "Fixe" },
  { value: "VARIABLE", label: "Variable" },
];

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

// Per-annotation "déport horizontal" of the label leader line: stub length
// (screen px) + mode (Fixe: the elbow follows the chip / Variable: the elbow
// stays put on the map). Shared by the Etiquette tab (sub-labels) and the
// Propriétés tab of standalone LABEL annotations. Unset = inherited from the
// template (read-time), see getAnnotationLabelStubConfig.
export default function FieldAnnotationLabelStub({
  annotation,
  overrideFields,
}) {
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const { length, mode } = getAnnotationLabelStubConfig(annotation);
  const isOwn = hasOwnLabelStubValue(annotation);
  const locked =
    Array.isArray(overrideFields) &&
    LABEL_STUB_FIELDS.some((f) => overrideFields.includes(f));
  const isStandaloneLabel = annotation?.type === "LABEL";

  // handlers

  async function update(updates) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, ...updates });
  }

  // Leaving VARIABLE drops the pinned elbow, so a later switch back does not
  // resurrect a stale one.
  function elbowPurge() {
    if (isStandaloneLabel) return { elbowPoint: null };
    if (!annotation?.labelDelta?.elbow) return {};
    const nextDelta = { ...annotation.labelDelta };
    delete nextDelta.elbow;
    return { labelDelta: nextDelta };
  }

  function handleLengthChange(raw) {
    const parsed = raw === "" ? 0 : Number(raw);
    update({
      labelStubLength: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    });
  }

  function handleModeChange(e, newMode) {
    if (!newMode || newMode === mode) return;
    update({
      labelStubMode: newMode,
      ...(newMode === "FIXED" ? elbowPurge() : {}),
    });
  }

  function handleReset() {
    update({ labelStubLength: null, labelStubMode: null, ...elbowPurge() });
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
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            ...(locked && { opacity: 0.5, pointerEvents: "none" }),
          }}
        >
          <InputBase
            type="number"
            value={length ?? ""}
            onChange={(e) => handleLengthChange(e.target.value)}
            inputProps={{ min: 0, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                px
              </Typography>
            }
            sx={numberInputSx}
          />
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            size="small"
            sx={toggleGroupSx}
          >
            {MODE_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
