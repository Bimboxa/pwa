import { Box, InputBase, Paper, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

import {
  getBufferCountPart,
  getBufferValuePart,
  withCopyCountPart,
  withCopyCountText,
} from "../utils/copyBuffer";

// ---------------------------------------------------------------------------
// SectionTypedConstraint — « Distance - Copies multiples » (Déplacer) /
// « Angle - Copies multiples » (Tourner) card of the drawing helper, 2D and
// 3D: the typed buffer `<valeur>[*<copies>]` split in two editable fields —
// the value with its unit and padlock (locked as soon as something is
// typed), the copy count behind a « x » — each with the keys that feed it.
// The keyboard feeds the buffer from anywhere (no focus needed); typing in
// a field writes the same buffer back (onChangeBuffer).
//
// variant: "MOVE" (default) | "ROTATE"
// buffer: the typed buffer; onChangeBuffer(nextBuffer); disabled: the
// fields are inert outside the phase that reads the buffer.
// ---------------------------------------------------------------------------

const FIELD_SX = {
  width: 72,
  px: 1,
  py: 0.25,
  borderRadius: 1,
  bgcolor: "action.hover",
  fontSize: "0.85rem",
  fontFamily: "monospace",
  fontWeight: 600,
  "& input": { p: 0, textAlign: "right" },
};

export default function SectionTypedConstraint({
  variant = "MOVE",
  buffer,
  onChangeBuffer,
  disabled = false,
}) {
  // strings

  const isRotate = variant === "ROTATE";
  const titleS = isRotate
    ? "Angle - Copies multiples"
    : "Distance - Copies multiples";
  const hintS = isRotate
    ? "Tapez une contrainte d'angle et / ou le nombre de copies"
    : "Tapez une contrainte de distance et / ou le nombre de copies";
  const unitS = isRotate ? "°" : "m";
  const timesS = "x";

  // helpers

  const current = buffer ?? "";
  const valueText = getBufferValuePart(current);
  const countText = getBufferCountPart(current);
  const locked = valueText !== "";
  const valueKeys = isRotate ? ["0-9", ".", "-"] : ["0-9", "."];

  // handlers

  function handleValueChange(e) {
    onChangeBuffer?.(withCopyCountPart(e.target.value, current));
  }

  function handleCountChange(e) {
    onChangeBuffer?.(withCopyCountText(e.target.value, current));
  }

  // The window-level tool listeners skip editable targets; keep the
  // editor's own Backspace / Delete shortcuts out of the fields too.
  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
  }

  // render

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
        {titleS}
      </Typography>
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          bgcolor: "action.hover",
          color: "text.secondary",
          fontSize: "0.8rem",
        }}
      >
        {hintS}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InputBase
            value={valueText}
            onChange={handleValueChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            inputProps={{ "aria-label": isRotate ? "Angle" : "Distance" }}
            sx={FIELD_SX}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {unitS}
          </Typography>
          {locked ? (
            <LockOutlined sx={{ fontSize: 16, color: "primary.main" }} />
          ) : (
            <LockOpenOutlined sx={{ fontSize: 16, color: "text.disabled" }} />
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {valueKeys.map((k) => (
            <ShortcutBadge key={k}>{k}</ShortcutBadge>
          ))}
          <Box sx={{ width: 6 }} />
          <ShortcutBadge>⌫</ShortcutBadge>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", width: 16, textAlign: "center" }}
          >
            {timesS}
          </Typography>
          <InputBase
            value={countText}
            onChange={handleCountChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            inputProps={{ "aria-label": "Copies", inputMode: "numeric" }}
            sx={FIELD_SX}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <ShortcutBadge>*</ShortcutBadge>
          <ShortcutBadge>0-9</ShortcutBadge>
          <Box sx={{ width: 6 }} />
          <ShortcutBadge>⌫</ShortcutBadge>
        </Box>
      </Box>
    </Paper>
  );
}
