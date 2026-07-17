import { useState } from "react";

import { Box, Popover, Typography } from "@mui/material";

import useRemoteImageUrl from "Features/misc/hooks/useRemoteImageUrl";

import { CARD_BORDER } from "../utils/dashboardStyles";

const MAX_STACKED = 3;

// Small stack of shared POV preview thumbnails on a dashboard project item.
// Hovering the stack opens a larger panel with all the previews and their
// descriptions.
function PovPreviewImage({ povPreview, sx }) {
  // data

  const imageUrl = useRemoteImageUrl(povPreview.imageUrlMaster);

  // render

  return (
    <Box
      sx={{
        overflow: "hidden",
        bgcolor: "action.hover",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...sx,
      }}
    >
      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt=""
          sx={{ width: 1, height: 1, objectFit: "cover" }}
        />
      )}
    </Box>
  );
}

export default function StackPovPreviews({ povPreviews }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const stacked = povPreviews?.slice(0, MAX_STACKED) ?? [];

  // render

  if (!stacked.length) return null;

  return (
    <>
      <Box
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
        sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}
      >
        {stacked.map((povPreview, index) => (
          <PovPreviewImage
            key={povPreview.idMaster}
            povPreview={povPreview}
            sx={{
              width: 44,
              height: 30,
              ml: index === 0 ? 0 : -3.5,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 1,
              bgcolor: "white",
              boxShadow: "0 1px 4px rgba(0,0,0,.12)",
              zIndex: stacked.length - index,
            }}
          />
        ))}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        // hover-only popover: it must not steal the mouse from the list item
        sx={{ pointerEvents: "none" }}
        disableRestoreFocus
      >
        <Box
          sx={{
            p: 1.5,
            maxWidth: 480,
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          {povPreviews.map((povPreview) => (
            <Box key={povPreview.idMaster} sx={{ width: 200 }}>
              <PovPreviewImage
                povPreview={povPreview}
                sx={{
                  width: 1,
                  height: 130,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 1.5,
                }}
              />
              {povPreview.description && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                  noWrap
                >
                  {povPreview.description}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
