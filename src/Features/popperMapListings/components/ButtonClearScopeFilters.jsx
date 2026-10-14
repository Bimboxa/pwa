import { Box, Button } from "@mui/material";
import FilterAltOff from "@mui/icons-material/FilterAltOff";

import useScopeContentFilters from "../hooks/useScopeContentFilters";

// Top of the SCOPE module « Contenu » tab: « Supprimer les filtres », shown
// only while a display filter of the « Annotations » / « Fonds de plan » tabs
// is active (useScopeContentFilters).
export default function ButtonClearScopeFilters() {
  // strings

  const labelS = "Supprimer les filtres";

  // data

  const { hasFilters, clearFilters } = useScopeContentFilters();

  // render

  if (!hasFilters) return null;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        px: 1,
        py: 0.5,
        borderBottom: "1px solid",
        borderColor: "panel.border",
      }}
    >
      <Button
        size="small"
        color="secondary"
        startIcon={<FilterAltOff sx={{ fontSize: 16 }} />}
        onClick={clearFilters}
        sx={{ textTransform: "none", fontSize: "0.75rem" }}
      >
        {labelS}
      </Button>
    </Box>
  );
}
