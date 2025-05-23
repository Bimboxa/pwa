import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box, Button, Paper, Typography} from "@mui/material";

export default function ButtonInPanel({
  label,
  onClick,
  bgcolor = "primary.main",
  color = "white",
  loading,
  variant,
  disabled,
}) {
  const isMobile = useIsMobile();
  const size = isMobile ? "large" : "medium";

  return (
    <Box sx={{width: 1, p: 1}}>
      <Paper sx={{width: 1, color}}>
        <Button
          disabled={disabled}
          fullWidth
          size={size}
          sx={{color: "inherit", bgcolor: disabled ? "white" : bgcolor}}
          //variant={variant ?? "contained"}
          variant="text"
          onClick={onClick}
          loading={loading}
        >
          <Typography color="inherit">{label}</Typography>
        </Button>
      </Paper>
    </Box>
  );
}
