import {Box, IconButton, Typography} from "@mui/material";

export default function HeaderVariantTitle({title}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 1,
        bgcolor: "background.default",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Box>
  );
}
