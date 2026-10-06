import { useState } from "react";

import { Box, Paper, Typography } from "@mui/material";

// Clickable option tile of the "Ajouter une liste" chooser: fixed size so the
// three options line up, elevation raised on hover, the whole tile is the
// click target (no action button).
export default function CardListingSourceOption({
  title,
  subtitle,
  icon: Icon,
  onClick,
}) {
  // state

  const [hovered, setHovered] = useState(false);

  // render

  return (
    <Paper
      elevation={hovered ? 6 : 1}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        width: 200,
        height: 220,
        p: 2,
        borderRadius: 2,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "box-shadow 0.15s",
      }}
    >
      <Box
        sx={{
          width: 1,
          height: 90,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.disabled",
        }}
      >
        <Icon sx={{ fontSize: 48 }} />
      </Box>

      <Typography
        variant="body2"
        sx={{ fontWeight: 600, mt: 1, textAlign: "center" }}
      >
        {title}
      </Typography>

      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textAlign: "center",
          mt: 0.5,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {subtitle}
      </Typography>
    </Paper>
  );
}
