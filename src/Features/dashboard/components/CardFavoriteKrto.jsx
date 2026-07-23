import { Box, Typography, IconButton, Tooltip, Button } from "@mui/material";
import {
  Star,
  GridOn,
  FolderOpen,
  CloudQueue,
  OpenInNew,
} from "@mui/icons-material";

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
        width: 190,
        p: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "white",
        cursor: "pointer",
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": {
          borderColor: "#c9c9d8",
          boxShadow: "0 2px 10px rgba(20,20,50,.06)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <GridOn sx={{ color: "text.secondary", fontSize: "1.05rem" }} />
          {!favorite.isLocal && (
            <Tooltip title="Krto non installé sur cet appareil">
              <CloudQueue sx={{ color: "text.secondary", fontSize: "0.95rem" }} />
            </Tooltip>
          )}
        </Box>
        <Tooltip title="Retirer des favoris">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onUnfavorite(favorite);
            }}
            sx={{ p: 0.25, mt: -0.5, mr: -0.5 }}
          >
            <Star sx={{ color: "#f5a623", fontSize: "1.1rem" }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography
        sx={{ fontWeight: 600, fontSize: 13, mt: 0.5, lineHeight: 1.25 }}
        noWrap
      >
        {favorite.name}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
        {favorite.type ?? " "}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
        <FolderOpen sx={{ color: "text.secondary", fontSize: ".85rem" }} />
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
          {favorite.projectName}
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        fullWidth
        startIcon={<OpenInNew sx={{ fontSize: "1rem" }} />}
        onClick={(e) => {
          e.stopPropagation();
          onOpenKrto(favorite);
        }}
        sx={{ mt: 1, textTransform: "none" }}
      >
        Ouvrir
      </Button>
    </Box>
  );
}
