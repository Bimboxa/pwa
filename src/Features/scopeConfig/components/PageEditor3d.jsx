import { Box, Typography } from "@mui/material";

import SectionNavigationPreset from "Features/threedEditor/components/SectionNavigationPreset";

// "Éditeurs > Éditeur 3D" page: device-local 3D editor preferences (the other
// 3D settings live in the contextual SETTINGS tool, session-only).
export default function PageEditor3d() {
  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Éditeur 3D
      </Typography>
      <SectionNavigationPreset />
    </Box>
  );
}
