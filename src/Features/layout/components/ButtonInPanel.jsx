import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box, Button, Paper, Typography} from "@mui/material";

export default function ButtonInPanel({
  label,
  onClick,
  bgcolor,
  color,
  loading,
  variant,
}) {
  const isMobile = useIsMobile();
  const size = isMobile ? "large" : "medium";

  return (
    <Box sx={{width: 1, p: 1}}>
      <Paper sx={{width: 1, bgcolor, color}}>
        <Button
          fullWidth
          size={size}
          variant={variant ?? "contained"}
          onClick={onClick}
          loading={loading}
        >
          <Typography>{label}</Typography>
        </Button>
      </Paper>
    </Box>
  );
}
