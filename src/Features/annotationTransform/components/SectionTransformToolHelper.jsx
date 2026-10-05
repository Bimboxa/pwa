import { Box, IconButton, Paper, Tooltip } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";

// ---------------------------------------------------------------------------
// SectionTransformToolHelper — drawing-helper body of the Extruder / Déplacer
// / Tourner tools, shared by the 2D editor (SectionTransformToolHelper2d) and
// the 3D one (SectionThreedToolHelperContent): the step hint, an optional
// numeric field mirroring the keyboard buffer, the shortcuts.
//
// field: { label, unit, value, onChangeText, onClear?, clearTitle? } | null
// ---------------------------------------------------------------------------

export default function SectionTransformToolHelper({ hint, field, shortcuts }) {
  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        sx={{
          px: 1.5,
          py: 1.5,
          borderRadius: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {hint}
      </Box>
      {field && (
        <Paper
          elevation={0}
          sx={{
            px: 0.5,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <FieldNumberCompact
            label={field.label}
            value={field.value}
            onChangeText={field.onChangeText}
            unit={field.unit}
          />
          {field.onClear && (
            <Tooltip title={field.clearTitle ?? ""}>
              <IconButton size="small" onClick={field.onClear}>
                <LockOutlinedIcon sx={{ fontSize: 18 }} color="primary" />
              </IconButton>
            </Tooltip>
          )}
        </Paper>
      )}
      <SectionShortcutHelpers shortcuts={shortcuts} />
    </Box>
  );
}
