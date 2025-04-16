import {Box, IconButton, Typography} from "@mui/material";

export default function HeaderVariantTitleIconButton({title, iconButton}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1,
        bgcolor: "background.default",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      {iconButton}
    </Box>
  );
}
