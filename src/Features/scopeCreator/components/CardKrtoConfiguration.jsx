import { Box, Chip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import hatchedIllustrationSx from "../utils/hatchedIllustrationSx";

export default function CardKrtoConfiguration({
  name,
  description,
  imageUrl,
  code,
  chipLabel,
  prerequisiteLabel,
  prerequisiteNames,
  selected,
  onClick,
}) {
  // helpers

  // configurations fed by a source Krto: one warning chip per source
  // configuration (« Pré-requis : <name> »)
  const prerequisites = prerequisiteNames?.filter(Boolean) ?? [];

  // render

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: selected ? "secondary.main" : "divider",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...(selected
          ? {
              boxShadow: (theme) =>
                `0 0 0 1px ${theme.palette.secondary.main}, 0 8px 24px ${alpha(
                  theme.palette.secondary.main,
                  0.12
                )}`,
            }
          : {
              "&:hover": { boxShadow: "0 6px 20px rgba(0,0,0,0.08)" },
            }),
      }}
    >
      <Box
        sx={{
          position: "relative",
          height: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...(!imageUrl && hatchedIllustrationSx),
        }}
      >
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={name}
            sx={{ width: 1, height: 1, objectFit: "contain", p: 1 }}
          />
        ) : (
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: 13,
              letterSpacing: "0.2em",
              color: "text.secondary",
            }}
          >
            {code}
          </Typography>
        )}

        {/* selection square */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 16,
            height: 16,
            borderRadius: 0.5,
            border: "1px solid",
            borderColor: selected ? "secondary.main" : "divider",
            bgcolor: selected ? "secondary.main" : "background.paper",
          }}
        />

        {/* category chip */}
        {chipLabel && (
          <Typography
            sx={{
              position: "absolute",
              bottom: 10,
              right: 10,
              bgcolor: "grey.800",
              color: "#fff",
              px: 1.25,
              py: 0.4,
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {chipLabel}
          </Typography>
        )}
      </Box>

      <Box sx={{ p: 2, pt: 1.5 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {name}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </Typography>

        {prerequisites.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
            {prerequisites.map((prerequisiteName) => (
              <Chip
                key={prerequisiteName}
                size="small"
                color="warning"
                label={`${prerequisiteLabel} : ${prerequisiteName}`}
                sx={{
                  height: "auto",
                  fontWeight: 600,
                  "& .MuiChip-label": {
                    whiteSpace: "normal",
                    py: 0.25,
                  },
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
