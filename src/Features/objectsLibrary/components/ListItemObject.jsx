import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Category } from "@mui/icons-material";

import { getTabLabel } from "../constants/objectsLibraryTabs";
import getObjectActionButton from "../utils/getObjectActionButton";

// List-row variant for one library object. Clicking the row opens the config
// dialog; the action button launches the figure's drawing tool (or 3D placement).
export default function ListItemObject({ object, onOpen, onLocate }) {
  const action = getObjectActionButton(object);
  const ActionIcon = action.Icon;
  return (
    <Box
      onClick={() => onOpen(object)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": { boxShadow: 2, borderColor: "primary.main" },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1.5,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
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
          <Category sx={{ color: "text.disabled" }} />
        )}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
          {object.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {getTabLabel(object.tab)}
        </Typography>
      </Box>
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
  );
}
