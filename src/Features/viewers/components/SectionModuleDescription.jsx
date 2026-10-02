import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import moduleDescriptions from "../constants/moduleDescriptions";

// Short description of a module (what it is for), shown right under the
// header of the module's default properties panel. Renders nothing for a
// module without a description.
export default function SectionModuleDescription({ moduleKey }) {
  // strings

  const descriptionS = moduleDescriptions[moduleKey];

  // render

  if (!descriptionS) return null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
        borderLeft: (theme) => `3px solid ${theme.palette.secondary.main}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{ display: "block", color: "secondary.dark", lineHeight: 1.4 }}
      >
        {descriptionS}
      </Typography>
    </Box>
  );
}
