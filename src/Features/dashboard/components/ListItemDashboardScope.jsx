import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import {
  Star,
  StarBorder,
  DeleteOutline,
  CloudQueue,
} from "@mui/icons-material";

import AvatarPovPreview from "./AvatarPovPreview";
import ChipsScopeStats from "./ChipsScopeStats";

// Renders one krto row — either a local scope or a remote (not installed)
// scope configuration. Clicking the row opens the krto.
// `row` = { scopeId, name, subText, isLocal, isFavorite, povPreviews,
//           annotationsCount, baseMapsCount }
// `subText` = "author trigram, last configuration date".

export default function ListItemDashboardScope({
  row,
  onToggleFavorite,
  onOpen,
  onDelete,
}) {
  // handlers

  function handleFavoriteClick(e) {
    e.stopPropagation();
    onToggleFavorite(row);
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    onDelete(row);
  }

  // render

  return (
    <Box
      onClick={() => onOpen(row)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1.25,
        cursor: "pointer",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
        "&:last-child": { borderBottom: "none" },
      }}
    >
      <Tooltip title={row.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
        <IconButton size="small" onClick={handleFavoriteClick} sx={{ p: 0.5 }}>
          {row.isFavorite ? (
            <Star sx={{ color: "#f5a623", fontSize: "1.2rem" }} />
          ) : (
            <StarBorder sx={{ color: "#b9b9c8", fontSize: "1.2rem" }} />
          )}
        </IconButton>
      </Tooltip>

      <AvatarPovPreview povPreviews={row.povPreviews} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
            {row.name}
          </Typography>
          {!row.isLocal && (
            <Tooltip title="Krto non installé sur cet appareil">
              <CloudQueue
                sx={{ color: "text.secondary", fontSize: "1.05rem", flexShrink: 0 }}
              />
            </Tooltip>
          )}
        </Box>
        {row.subText && (
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            {row.subText}
          </Typography>
        )}
      </Box>

      <ChipsScopeStats
        baseMapsCount={row.baseMapsCount}
        annotationsCount={row.annotationsCount}
      />

      {row.isLocal && (
        <Tooltip title="Supprimer">
          <IconButton
            size="small"
            onClick={handleDeleteClick}
            sx={{ color: "text.secondary" }}
          >
            <DeleteOutline />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
