import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import { DeleteSweep, PlayArrow, Refresh } from "@mui/icons-material";

/**
 * One-line launcher of an automated procedure: caption + procedure label on
 * the left, delete (while outputs exist) + play / refresh on the right,
 * `actions` slot after them (e.g. a procedure selector), `children` rendered
 * below the line (e.g. the parameters of the procedure). Shared by the
 * listing « Dessin auto » band and the revolution-axis toolbar.
 */
export default function RowProcedureRun({
  caption = "Dessin auto",
  label,
  hasOutputs = false,
  busy = false,
  playDisabled = false,
  playTitle,
  deleteTitle,
  onPlay,
  onDelete,
  actions = null,
  children = null,
  sx,
}) {
  // render

  return (
    <Box
      sx={{
        bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.85),
        borderRadius: 1,
        overflow: "hidden",
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
          pl: 1.25,
          pr: 0.5,
          py: 0.25,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {caption && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.4,
              }}
            >
              {caption}
            </Typography>
          )}
          <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {busy && <CircularProgress size={14} sx={{ mr: 0.5 }} />}
          {hasOutputs && onDelete && (
            <Tooltip title={deleteTitle ?? ""}>
              <span>
                <IconButton size="small" onClick={onDelete} disabled={busy}>
                  <DeleteSweep sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={playTitle ?? ""}>
            <span>
              <IconButton
                size="small"
                color="secondary"
                onClick={onPlay}
                disabled={busy || playDisabled}
              >
                {hasOutputs ? (
                  <Refresh sx={{ fontSize: 20 }} />
                ) : (
                  <PlayArrow sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
          {actions}
        </Box>
      </Box>

      {children && (
        <Box
          sx={{
            px: 1.25,
            py: 0.5,
            bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.93),
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
