import useIsMobile from "Features/layout/hooks/useIsMobile";

import { Box, Button, Paper, Typography } from "@mui/material";

export default function ButtonInPanelV2({ label, ...buttonProps }) {
  return (
    <Box sx={{ width: 1, p: 1 }}>
      <Box sx={{ width: 1 }}>
        <Button {...buttonProps} fullWidth>
          <Typography
            variant={buttonProps.size === "small" ? "body2" : "body1"}
          >
            {label}
          </Typography>
        </Button>
      </Box>
    </Box>
  );
}
