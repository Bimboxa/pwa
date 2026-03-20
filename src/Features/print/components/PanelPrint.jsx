import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import CardPortfolioList from "Features/portfolios/components/CardPortfolioList";

export default function PanelPrint() {
  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box sx={{ p: 0.5, pl: 2 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            fontSize: (theme) => theme.typography.caption.fontSize,
          }}
        >
          Module
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Impression
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        <CardPortfolioList />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
