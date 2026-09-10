import { Avatar } from "@mui/material";
import { alpha } from "@mui/material/styles";

import getListingAvatarString from "Features/listings/utils/getListingAvatarString";

// ---------------------------------------------------------------------------
// AvatarListing — round initials avatar of a listing.
// variant: "selected" (intense secondary), "visible" (light secondary),
// "muted" (grey: hidden listing or no annotation).
// ---------------------------------------------------------------------------

export default function AvatarListing({
  listing,
  size = 28,
  variant = "visible",
  onClick,
  onDoubleClick,
  sx,
}) {
  // helpers

  const text = getListingAvatarString(listing);

  const variantSx = (theme) => {
    switch (variant) {
      case "selected":
        return {
          bgcolor: theme.palette.secondary.main,
          color: theme.palette.secondary.contrastText,
        };
      case "muted":
        return {
          bgcolor: theme.palette.panel.countEmpty,
          color: theme.palette.panel.textMuted,
        };
      case "visible":
      default:
        return {
          bgcolor: alpha(theme.palette.secondary.main, 0.3),
          color: theme.palette.secondary.dark,
        };
    }
  };

  // render

  return (
    <Avatar
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={[
        (theme) => ({
          width: size,
          height: size,
          fontSize: Math.round(size * 0.4),
          fontWeight: 700,
          letterSpacing: "0.02em",
          flexShrink: 0,
          cursor: onClick || onDoubleClick ? "pointer" : "default",
          userSelect: "none",
          transition: "transform 120ms, box-shadow 120ms",
          ...((onClick || onDoubleClick) && {
            "&:hover": {
              transform: "scale(1.08)",
              boxShadow: `0 0 0 2px ${alpha(theme.palette.secondary.main, 0.35)}`,
            },
          }),
          ...variantSx(theme),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {text}
    </Avatar>
  );
}
