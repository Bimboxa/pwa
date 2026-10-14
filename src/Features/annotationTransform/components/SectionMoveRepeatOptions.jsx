import { Box, Button, Paper, Switch, Tooltip, Typography } from "@mui/material";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

import {
  MOVE_COPY_BUTTON_HINT,
  MOVE_COPY_BUTTON_LABEL,
  MOVE_REPEAT_HINT,
  MOVE_REPEAT_LABEL,
} from "../constants/transformToolStrings";

// ---------------------------------------------------------------------------
// SectionMoveRepeatOptions — « Recommencer à chaque clic » (R) switch and
// « Copier » (C) button of the « Déplacer » helper, 2D and 3D, under the
// « Distance - Copies multiples » card. The keys work from anywhere (the
// tool's keyboard listener); the controls write the same state.
//   repeat / onToggleRepeat: the option (session store in 2D, slice in 3D)
//   onCopy: « Copier » — copy count 1 unless some are typed + repeat on
//   copyDisabled: a revolution axis is carried (never copied)
// ---------------------------------------------------------------------------

export default function SectionMoveRepeatOptions({
  repeat,
  onToggleRepeat,
  onCopy,
  copyDisabled = false,
}) {
  // render

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 2,
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Tooltip title={MOVE_REPEAT_HINT} placement="left">
        <Box
          sx={{
            px: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {MOVE_REPEAT_LABEL}
            </Typography>
            <ShortcutBadge>R</ShortcutBadge>
          </Box>
          <Switch
            size="small"
            checked={Boolean(repeat)}
            onChange={(e) => {
              // The tool's keys (R / C / digits) skip editable targets: a
              // focused switch input would swallow them.
              e.target.blur();
              onToggleRepeat?.();
            }}
            inputProps={{ "aria-label": MOVE_REPEAT_LABEL }}
          />
        </Box>
      </Tooltip>
      <Tooltip title={MOVE_COPY_BUTTON_HINT} placement="left">
        <Box
          sx={{
            px: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyOutlined />}
            onClick={() => onCopy?.()}
            disabled={copyDisabled}
            sx={{ textTransform: "none" }}
          >
            {MOVE_COPY_BUTTON_LABEL}
          </Button>
          <ShortcutBadge>C</ShortcutBadge>
        </Box>
      </Tooltip>
    </Paper>
  );
}
