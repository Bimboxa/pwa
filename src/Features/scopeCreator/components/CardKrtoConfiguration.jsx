import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function CardKrtoConfiguration({
  name,
  description,
  imageUrl,
  selected,
  onClick,
}) {
  // render

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        cursor: "pointer",
        borderRadius: "8px",
        p: 1,
        border: "1px solid",
        ...(selected
          ? {
              borderColor: (theme) => alpha(theme.palette.secondary.main, 0.5),
              bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
            }
          : {
              borderColor: "transparent",
              "&:hover": { bgcolor: "action.hover" },
            }),
      }}
    >
      <Box
        sx={{
          width: 1,
          height: 110,
          borderRadius: "8px",
          border: "1px solid",
          borderStyle: imageUrl ? "solid" : "dashed",
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt={name}
            sx={{ width: 1, height: 1, objectFit: "contain" }}
          />
        )}
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
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
    </Box>
  );
}
