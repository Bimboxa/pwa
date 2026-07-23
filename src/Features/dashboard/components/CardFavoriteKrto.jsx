import { Box, Typography, IconButton, Tooltip, Divider } from "@mui/material";
import { Star, CloudQueue, OpenInNew } from "@mui/icons-material";

export default function CardFavoriteKrto({
  favorite,
  onOpen,
  onOpenKrto,
  onUnfavorite,
}) {
  // render

  return (
    <Box
      onClick={() => onOpen(favorite)}
      sx={{
        flex: "0 0 auto",
        width: 240,
        p: 2,
        borderRadius: 3,
        bgcolor: "white",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(20,20,50,.06)",
        transition: "box-shadow .15s",
        "&:hover": {
          boxShadow: "0 4px 16px rgba(20,20,50,.10)",
        },
        // reveal the open button on hover / keyboard focus
        "&:hover .favorite-open-btn, &:focus-within .favorite-open-btn": {
          opacity: 1,
          pointerEvents: "auto",
        },
      }}
    >
      {/* title */}
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: 16,
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {favorite.name}
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      {/* footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <Tooltip title="Retirer des favoris">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onUnfavorite(favorite);
              }}
              sx={{ p: 0.25, flexShrink: 0 }}
            >
              <Star sx={{ color: "#e07a3f", fontSize: "1.3rem" }} />
            </IconButton>
          </Tooltip>
          <Typography
            sx={{ color: "text.secondary", fontSize: 15 }}
            noWrap
          >
            {favorite.type ?? " "}
          </Typography>
          {!favorite.isLocal && (
            <Tooltip title="Krto non installé sur cet appareil">
              <CloudQueue
                sx={{ color: "text.secondary", fontSize: "0.95rem", flexShrink: 0 }}
              />
            </Tooltip>
          )}
        </Box>

        <Tooltip title="Ouvrir le Krto">
          <IconButton
            className="favorite-open-btn"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onOpenKrto(favorite);
            }}
            sx={{
              flexShrink: 0,
              opacity: 0,
              pointerEvents: "none",
              transition: "opacity .15s",
              borderRadius: 1.5,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <OpenInNew sx={{ fontSize: "1.15rem", color: "text.secondary" }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
