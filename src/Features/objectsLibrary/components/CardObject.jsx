import { useState } from "react";

import { Box, Typography, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Category } from "@mui/icons-material";

import getObjectActionButton from "../utils/getObjectActionButton";

// Grid card for one library object. Clicking the card opens the configuration
// dialog; the action button — pinned at the bottom-right of the thumbnail —
// launches the figure's drawing tool (or 3D placement) and reveals the action
// name while the thumbnail is hovered.
export default function CardObject({ object, onOpen, onLocate }) {
  // data

  const action = getObjectActionButton(object);
  const ActionIcon = action.Icon;

  // state

  const [thumbnailHovered, setThumbnailHovered] = useState(false);

  // render

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
        onMouseEnter={() => setThumbnailHovered(true)}
        onMouseLeave={() => setThumbnailHovered(false)}
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

        {action.placeable && (
          <ButtonBase
            onClick={(e) => {
              e.stopPropagation();
              onLocate(object);
            }}
            sx={{
              position: "absolute",
              bottom: 4,
              right: 4,
              maxWidth: "calc(100% - 8px)",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              py: 0.5,
              px: 0.75,
              borderRadius: 4,
              bgcolor: "background.paper",
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: 1,
              color: "primary.main",
              "&:hover": {
                color: "secondary.main",
                bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
              },
            }}
          >
            <ActionIcon fontSize="small" />
            {thumbnailHovered && (
              <Typography variant="caption" noWrap sx={{ lineHeight: 1 }}>
                {action.label}
              </Typography>
            )}
          </ButtonBase>
        )}
      </Box>

      <Box sx={{ p: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: "bold",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            lineHeight: 1.25,
            minHeight: "2.5em",
          }}
        >
          {object.label}
        </Typography>
      </Box>
    </Box>
  );
}
