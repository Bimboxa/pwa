import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box, Button, Paper} from "@mui/material";

export default function ButtonInPanel({
  label,
  onClick,
  bgcolor,
  color,
  loading,
}) {
  const isMobile = useIsMobile();
  const size = isMobile ? "large" : "medium";

  return (
    <Box sx={{width: 1, p: 1}}>
      <Paper sx={{width: 1, bgcolor, color}}>
        <Button
          fullWidth
          size={size}
          variant="contained"
          onClick={onClick}
          loading={loading}
        >
          {label}
        </Button>
      </Paper>
    </Box>
  );
}
