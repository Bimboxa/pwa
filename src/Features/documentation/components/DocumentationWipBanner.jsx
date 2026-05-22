import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {Box, Typography} from "@mui/material";

export default function DocumentationWipBanner() {
  return (
    <Box
      role="alert"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 0.75,
        bgcolor: "secondary.main",
        color: "common.white",
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <WarningAmberIcon fontSize="small" />
      <Typography variant="body2" sx={{fontWeight: 600}}>
        Document en cours de construction
      </Typography>
    </Box>
  );
}
