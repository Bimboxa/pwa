import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Category, DragIndicator } from "@mui/icons-material";

import getObjectActionButton from "../utils/getObjectActionButton";

// Grid card for one library object. Clicking the card opens the configuration
// dialog; the action button launches the figure's drawing tool (or 3D placement).
export default function CardObject({ object, onOpen, onLocate }) {
  const action = getObjectActionButton(object);
  const ActionIcon = action.Icon;
  return (
    <Box
      onClick={() => onOpen(object)}
      sx={{
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": { boxShadow: 3, borderColor: "primary.main" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "1 / 1",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {object.thumbnailUrl ? (
          <Box
            component="img"
            src={object.thumbnailUrl}
            alt={object.label}
            sx={{ width: "70%", height: "70%", objectFit: "contain" }}
          />
        ) : (
          <Category sx={{ fontSize: 48, color: "text.disabled" }} />
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, p: 1 }}>
        <DragIndicator fontSize="small" sx={{ color: "text.disabled" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", flexGrow: 1, minWidth: 0 }}
          noWrap
        >
          {object.label}
        </Typography>
        {action.placeable && (
          <Tooltip title={action.tooltip}>
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onLocate(object);
              }}
              sx={{
                "&:hover": {
                  color: "secondary.main",
                  bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
                },
              }}
            >
              <ActionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
