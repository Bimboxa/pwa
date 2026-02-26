import { Box, Chip, Typography } from "@mui/material";
import { Lock } from "@mui/icons-material";

export default function BlockEntityModel({ model, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1,
        cursor: "pointer",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
        borderRadius: 1,
      }}
    >
      {model.readonly && <Lock sx={{ fontSize: "0.875rem", color: "text.secondary" }} />}
      <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
        {model.name || model.key}
      </Typography>
      <Chip label={model.key} size="small" variant="outlined" />
    </Box>
  );
}
