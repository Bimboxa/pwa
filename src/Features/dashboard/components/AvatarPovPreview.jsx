import { useState } from "react";

import { Box, Popover, Typography } from "@mui/material";

import useRemoteImageUrl from "Features/misc/hooks/useRemoteImageUrl";

import { CARD_BORDER } from "../utils/dashboardStyles";

// Small avatar-like thumbnail showing the first shared POV preview of a
// scope. Hovering it opens a larger version of the image. Renders nothing
// when the scope has no POV preview.
// `povPreviews` items = { idMaster, sortIndex, imageUrlMaster, description }.

export default function AvatarPovPreview({ povPreviews, size = 34 }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  // first preview by fractional sortIndex (plain ASCII comparison, same rule
  // as usePovs / useDashboardProjectItems)
  const first = [...(povPreviews ?? [])].sort((a, b) =>
    (a.sortIndex ?? "") < (b.sortIndex ?? "") ? -1 : 1
  )[0];

  // data

  const imageUrl = useRemoteImageUrl(first?.imageUrlMaster);

  // render

  if (!first) return null;

  return (
    <>
      <Box
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 1,
          border: `1px solid ${CARD_BORDER}`,
          overflow: "hidden",
          bgcolor: "action.hover",
        }}
      >
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt=""
            sx={{ width: 1, height: 1, objectFit: "cover", display: "block" }}
          />
        )}
      </Box>

      <Popover
        open={Boolean(anchorEl) && Boolean(imageUrl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        // hover-only popover: it must not steal the mouse from the list item
        sx={{ pointerEvents: "none" }}
        disableRestoreFocus
      >
        <Box sx={{ p: 1 }}>
          <Box
            component="img"
            src={imageUrl}
            alt=""
            sx={{
              display: "block",
              width: 320,
              maxHeight: 240,
              objectFit: "cover",
              borderRadius: 1.5,
              border: `1px solid ${CARD_BORDER}`,
            }}
          />
          {first.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
              noWrap
            >
              {first.description}
            </Typography>
          )}
        </Box>
      </Popover>
    </>
  );
}
