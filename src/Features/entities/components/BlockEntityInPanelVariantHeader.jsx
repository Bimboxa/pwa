import { Box, Typography, IconButton, Paper } from "@mui/material";

import IconButtonClose from "Features/layout/components/IconButtonClose";

import { ArrowBackIos as Back } from "@mui/icons-material";
import { useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import useIsMobile from "Features/layout/hooks/useIsMobile";

export default function BlockEntityInPanelVariantHeader({
  label,
  onClose,
  bgcolor,
}) {
  const theme = useTheme();

  const textColor = useMemo(() => {
    const contrastText = theme.palette.getContrastText(bgcolor);
    return contrastText;
  }, [bgcolor, theme.palette]);

  const isMobile = useIsMobile();

  // handlers

  function handleClose() {
    console.log("close");
    onClose();
  }

  return (
    <Box sx={{ p: 1, width: 1 }}>
      <Paper
        sx={{
          bgcolor,
          color: textColor,
          display: "flex",
          alignItems: "center",
          px: 1,
          py: 0.5,
          borderRadius: 2,
          justifyContent: "space-between",
          width: 1,
        }}
      >
        <Typography
          sx={{ fontWeight: isMobile ? "normal" : "bold" }}
          variant={isMobile ? "body2" : "body1"}
        >
          {label}
        </Typography>
        <IconButtonClose onClose={handleClose} sx={{ color: "inherit" }} />
      </Paper>
    </Box>
  );
}
