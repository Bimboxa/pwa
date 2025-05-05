import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box, Button, Paper, Typography} from "@mui/material";

export default function ButtonInPanel({
  label,
  onClick,
  bgcolor = "primary.main",
  color = "white",
  loading,
  variant,
}) {
  const isMobile = useIsMobile();
  const size = isMobile ? "large" : "medium";

  if (!bgcolor) bgcolor = "primary.main";
  if (!isMobile) color = "text.primary";

  return (
    <Box sx={{width: 1, p: 1}}>
      <Paper sx={{width: 1, bgcolor, color}}>
        <Button
          fullWidth
          size={size}
          sx={{color: "inherit"}}
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
