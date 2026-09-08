import { Box, IconButton, Typography } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

// Header of a Krnet listing-configuration sub-view: back arrow (pops the
// view stack), context caption, view title and an optional right action.
export default function HeaderListingConfigView({
  caption,
  title,
  onBack,
  action,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        p: 0.5,
        pl: 1,
        gap: 1,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <IconButton onClick={onBack} size="small">
        <Back />
      </IconButton>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {caption && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {caption}
          </Typography>
        )}
        <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
          {title}
        </Typography>
      </Box>
      {action}
    </Box>
  );
}
