import { Box, Typography, IconButton, CircularProgress, Tooltip } from "@mui/material";
import { Star, Refresh } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import CardFavoriteKrto from "./CardFavoriteKrto";

export default function SectionFavoriteKrtos({
  favorites,
  onOpen,
  onUnfavorite,
  onRefresh,
  refreshing,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const titleS = appConfig?.strings?.scope?.favorites ?? "Krtos favoris";

  // render

  if (!favorites?.length) return null;

  return (
    <Box sx={{ pb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, px: 0.5 }}>
        <Star sx={{ color: "#f5a623", fontSize: "1rem" }} />
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.06em" }}
        >
          {titleS}
        </Typography>
        <Tooltip title="Mettre à jour les favoris">
          <span>
            <IconButton size="small" onClick={onRefresh} disabled={refreshing} sx={{ p: 0.25 }}>
              {refreshing ? (
                <CircularProgress size={14} />
              ) : (
                <Refresh sx={{ fontSize: "1.05rem", color: "text.secondary" }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "#d7d7e2", borderRadius: 3 },
        }}
      >
        {favorites.map((favorite) => (
          <CardFavoriteKrto
            key={favorite.scopeId}
            favorite={favorite}
            onOpen={onOpen}
            onUnfavorite={onUnfavorite}
          />
        ))}
      </Box>
    </Box>
  );
}
