import {
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import { Star, StarBorder, Refresh } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import CardFavoriteKrto from "./CardFavoriteKrto";
import CardEmptySection from "./CardEmptySection";

import {
  STAR_COLOR,
  SEGMENT_BG,
  TEXT_MUTED,
  fadeUp,
} from "../utils/dashboardStyles";

export default function SectionFavoriteKrtos({
  favorites,
  onOpen,
  onOpenKrto,
  onUnfavorite,
  onRefresh,
  refreshing,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const titleS = appConfig?.strings?.scope?.favorites ?? "Repérages favoris";
  const emptyTitleS =
    appConfig?.strings?.scope?.noFavoriteTitle ?? "Aucun favori pour l'instant";
  const emptyHintS =
    appConfig?.strings?.scope?.noFavoriteHint ??
    "Touchez l'étoile ★ sur un repérage pour l'épingler ici et le rouvrir en un geste.";
  const comingSoonS = appConfig?.strings?.general?.comingSoon ?? "Prochainement";

  // render

  return (
    <Box sx={fadeUp(0.25)}>
      {/* header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Star sx={{ color: STAR_COLOR, fontSize: 22 }} />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {titleS}
          </Typography>
          <Chip
            size="small"
            label={comingSoonS}
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              bgcolor: SEGMENT_BG,
              color: TEXT_MUTED,
              borderRadius: 999,
            }}
          />
        </Box>
        <Tooltip title="Mettre à jour les favoris">
          <span>
            <IconButton onClick={onRefresh} disabled={refreshing}>
              {refreshing ? (
                <CircularProgress size={16} />
              ) : (
                <Refresh sx={{ color: "text.secondary" }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* content */}
      <Box sx={{ mt: 2.5 }}>
        {!favorites?.length ? (
          <CardEmptySection
            icon={<StarBorder sx={{ fontSize: "2rem" }} />}
            iconColor={STAR_COLOR}
            title={emptyTitleS}
            hint={emptyHintS}
          />
        ) : (
          <Box
            sx={{
              display: "flex",
              gap: 1.25,
              overflowX: "auto",
              pb: 1,
              "&::-webkit-scrollbar": { height: 6 },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "#E0D8D2",
                borderRadius: 3,
              },
            }}
          >
            {favorites.map((favorite) => (
              <CardFavoriteKrto
                key={favorite.scopeId}
                favorite={favorite}
                onOpen={onOpen}
                onOpenKrto={onOpenKrto}
                onUnfavorite={onUnfavorite}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
