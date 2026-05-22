import {Link as RouterLink} from "react-router-dom";

import CloseIcon from "@mui/icons-material/Close";
import {Box, IconButton, Typography} from "@mui/material";

export default function DocumentationHeader({title}) {
  return (
    <Box
      component="header"
      sx={{
        height: 48,
        minHeight: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: "background.default",
      }}
    >
      <Typography variant="subtitle2" sx={{fontWeight: 600}}>
        {title}
      </Typography>
      <IconButton
        size="small"
        component={RouterLink}
        to="/"
        aria-label="Back to app"
        title="Back to app"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
