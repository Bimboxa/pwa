import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import ListListings from "Features/listings/components/ListListings";

// One family section of the SCOPE module panel: the family icon + label, a
// "+" opening that family's own creation dialog, then its listings. The rows
// carry no icon of their own — the header says what they are.
export default function SectionListingsGroup({
  group,
  selection,
  onListingClick,
  onCreateClick,
}) {
  // strings

  const createS = `Nouvelle liste — ${group.label}`;

  // render

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          pt: 1.5,
          pb: 0.5,
        }}
      >
        {group.icon && (
          <Box
            sx={{
              display: "flex",
              color: "text.secondary",
              "& svg": { fontSize: 18 },
            }}
          >
            {group.icon}
          </Box>
        )}
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            minWidth: 0,
            color: "text.secondary",
            textTransform: "uppercase",
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
          noWrap
        >
          {group.label}
        </Typography>
        {onCreateClick && (
          <Tooltip title={createS}>
            <IconButton
              size="small"
              color="secondary"
              onClick={() => onCreateClick(group)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ bgcolor: "white" }}>
        <ListListings
          listings={group.listings}
          onClick={onListingClick}
          selection={selection}
          showIcon={false}
        />
      </Box>
    </Box>
  );
}
