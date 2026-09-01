import { Box, Typography } from "@mui/material";

import SectionVertexSize from "Features/mapEditor/components/SectionVertexSize";

// "Éditeurs > Éditeur 2D" page: device-local 2D editor preferences. The
// vertex size card is shared with the right-panel SETTINGS tool.
export default function PageEditor2d() {
  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Éditeur 2D
      </Typography>
      <SectionVertexSize />
    </Box>
  );
}
