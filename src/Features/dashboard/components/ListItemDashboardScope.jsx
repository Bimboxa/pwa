import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import {
  Star,
  StarBorder,
  DeleteOutline,
  CloudQueue,
} from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

// Renders one krto row — either a local scope or a remote (not installed)
// scope configuration. `row` = { scopeId, name, type, isLocal, isFavorite }.

export default function ListItemDashboardScope({
  row,
  onToggleFavorite,
  onOpen,
  onDelete,
}) {
  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:hover": { bgcolor: "rgba(0,0,0,0.02)" },
        "&:last-child": { borderBottom: "none" },
      }}
    >
      <Tooltip title={row.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
        <IconButton size="small" onClick={() => onToggleFavorite(row)} sx={{ p: 0.5 }}>
          {row.isFavorite ? (
            <Star sx={{ color: "#f5a623", fontSize: "1.2rem" }} />
          ) : (
            <StarBorder sx={{ color: "#b9b9c8", fontSize: "1.2rem" }} />
          )}
        </IconButton>
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0.75 }}>
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

      {row.type && (
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", width: 170, flexShrink: 0 }}
          noWrap
        >
          {row.type}
        </Typography>
      )}

      <ButtonGeneric
        variant="contained"
        size="small"
        label="Ouvrir"
        onClick={() => onOpen(row)}
        sx={{ px: 2 }}
      />

      {row.isLocal && (
        <IconButton
          size="small"
          onClick={() => onDelete(row)}
          sx={{ color: "text.secondary" }}
        >
          <DeleteOutline />
        </IconButton>
      )}
    </Box>
  );
}
