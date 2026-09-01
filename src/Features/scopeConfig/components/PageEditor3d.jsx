import { Box, Typography } from "@mui/material";

// "Éditeurs > Éditeur 3D" page: placeholder — the 3D editor has no persisted
// device preference yet (its settings live in the contextual SETTINGS tool,
// session-only).
export default function PageEditor3d() {
  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Éditeur 3D
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Aucun réglage disponible pour le moment.
      </Typography>
    </Box>
  );
}
