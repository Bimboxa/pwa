import { Box, Typography } from "@mui/material";
import { darken } from "@mui/material/styles";

import {
  TABS_BAND_DARKEN,
  TAB_DARKEN,
  TAB_HOVER_DARKEN,
  TABS_HEIGHT,
} from "../constants/baseMapsGridConstants";

// Top band of the grid: one divider tab per base maps listing. Everything
// derives from the editor background: the selected tab takes the table colour
// (so it reads as the tab of the displayed table), the band and the other
// tabs are darker shades of it.
export default function BaseMapsGridTabs({
  listings,
  countByListingId,
  selectedListingId,
  onSelect,
}) {
  // render

  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: TABS_HEIGHT,
        display: "flex",
        alignItems: "flex-end",
        gap: 0.5,
        px: 2,
        // room for the buttons of the top-right corner
        pr: 34,
        bgcolor: (theme) =>
          darken(theme.palette.background.default, TABS_BAND_DARKEN),
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {listings?.map((listing) => {
        const selected = listing.id === selectedListingId;
        const count = countByListingId?.[listing.id] ?? 0;
        return (
          <Box
            key={listing.id}
            component="button"
            onClick={() => onSelect?.(listing.id)}
            sx={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 1,
              height: selected ? TABS_HEIGHT - 8 : TABS_HEIGHT - 12,
              px: 2,
              border: "none",
              borderRadius: "10px 10px 0 0",
              cursor: "pointer",
              bgcolor: (theme) =>
                darken(
                  theme.palette.background.default,
                  selected ? 0 : TAB_DARKEN
                ),
              color: selected ? "text.primary" : "text.secondary",
              transition: "background-color 0.15s ease, height 0.15s ease",
              "&:hover": {
                bgcolor: (theme) =>
                  darken(
                    theme.palette.background.default,
                    selected ? 0 : TAB_HOVER_DARKEN
                  ),
              },
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: selected ? 600 : 400, maxWidth: 220 }}
            >
              {listing.name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {count}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
