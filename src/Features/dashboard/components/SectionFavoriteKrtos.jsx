import { Box, Typography } from "@mui/material";
import { Star } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import CardFavoriteKrto from "./CardFavoriteKrto";

export default function SectionFavoriteKrtos({ favorites, onOpen, onUnfavorite }) {
  // data

  const appConfig = useAppConfig();

  // strings

  const titleS = appConfig?.strings?.scope?.favorites ?? "Krtos favoris";

  // render

  if (!favorites?.length) return null;

  return (
    <Box sx={{ px: 1.5, pb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, px: 0.5 }}>
        <Star sx={{ color: "#f5a623", fontSize: "1rem" }} />
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.06em" }}
        >
          {titleS}
        </Typography>
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
