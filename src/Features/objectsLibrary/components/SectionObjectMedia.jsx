import { Box, Typography } from "@mui/material";
import { PlayArrow } from "@mui/icons-material";

import { getTabLabel } from "../constants/objectsLibraryTabs";

function MetaChip({ label, value }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 120,
        bgcolor: "action.hover",
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {value}
      </Typography>
    </Box>
  );
}

// Left column of the object dialog: tutorial video (or a placeholder player)
// + description + Type / Dimensions / Catégorie chips.
export default function SectionObjectMedia({ object }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        sx={{
          position: "relative",
          width: 1,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "#1e1e1e",
          aspectRatio: "16 / 9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {object.videoUrl ? (
          <video
            src={object.videoUrl}
            controls
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <>
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                top: 8,
                left: 12,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Tutoriel — Comment dessiner {object.label}
            </Typography>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: 6,
              }}
            >
              <PlayArrow sx={{ color: "#fff", fontSize: 40 }} />
            </Box>
          </>
        )}
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">
          Description
        </Typography>
        <Typography variant="body1">{object.description}</Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <MetaChip label="Type" value={getTabLabel(object.tab)} />
        {object.dimensionsLabel && (
          <MetaChip label="Dimensions" value={object.dimensionsLabel} />
        )}
        {object.category && (
          <MetaChip label="Catégorie" value={object.category} />
        )}
      </Box>
    </Box>
  );
}
