import { Box, Typography } from "@mui/material";
import { Construction } from "@mui/icons-material";

export default function SectionUnderConstruction() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        p: 4,
        height: 1,
        color: "text.secondary",
      }}
    >
      <Construction sx={{ fontSize: 48, opacity: 0.4 }} />
      <Typography variant="body1" sx={{ fontWeight: "bold" }}>
        En cours de construction
      </Typography>
      <Typography variant="body2" sx={{ textAlign: "center" }}>
        Cette catégorie sera bientôt disponible.
      </Typography>
    </Box>
  );
}
