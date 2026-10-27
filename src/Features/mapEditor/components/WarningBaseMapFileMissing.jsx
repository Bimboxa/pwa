import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import WarningAmber from "@mui/icons-material/WarningAmber";

// ---------------------------------------------------------------------------
// WarningBaseMapFileMissing — overlay shown when the active base map image
// has no db.files row on this device: the folder was hidden in the scope
// when the Krto was saved, so the zip shipped the metadata (and the inline
// low-res preview when one existed) without the image file. Same look as
// WarningBaseMapNotToScale, positioned like TopPhotoPlanChips.
// ---------------------------------------------------------------------------

export default function WarningBaseMapFileMissing({ hasPreview, sx }) {
  // strings

  const titleS = "Fichier du fond de plan indisponible sur cet appareil.";
  const detailS = hasPreview
    ? "Aperçu basse résolution — le dossier était masqué lors de l'enregistrement du Krto."
    : "Le dossier était masqué lors de l'enregistrement du Krto.";

  // render

  return (
    <Box
      sx={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        maxWidth: "calc(100% - 32px)",
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
        backdropFilter: "blur(4px)",
        border: "1px solid",
        borderColor: (theme) => alpha(theme.palette.error.main, 0.3),
        pointerEvents: "none",
        ...sx,
      }}
    >
      <WarningAmber sx={{ fontSize: 18, color: "error.main", flexShrink: 0 }} />
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "error.main",
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          {titleS}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "error.main", lineHeight: 1.3 }}
        >
          {detailS}
        </Typography>
      </Box>
    </Box>
  );
}
