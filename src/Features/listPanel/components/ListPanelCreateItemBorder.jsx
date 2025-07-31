import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import { Box } from "@mui/material";

import { lighten, alpha } from "@mui/material/styles";
import theme from "Styles/theme";

export default function ListPanelCreateItemBorder({ children }) {
  const baseColor = theme.palette.secondary.main;
  const shiningColor = alpha(lighten(baseColor, 0.9), 0.9);

  return (
    <BoxFlexVStretch sx={{ position: "relative" }}>
      <Box
        sx={{
          zIndex: 3,
          width: 1,

          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          position: "relative",
        }}
      >
        {children}
      </Box>

      <Box
        sx={{
          position: "absolute",
          borderRadius: 2,
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          //border: `2px solid ${baseColor}`,
          border: `2px solid ${baseColor}`,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          top: 0,
          left: 0,
          borderRadius: 2,
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: "-2px",
            left: "-2px",
            right: "-2px",
            bottom: "-2px",
            borderRadius: "inherit",
            padding: "2px",
            background: `conic-gradient(from 0deg, transparent 0deg, ${shiningColor} 60deg, transparent 120deg)`,
            animation: "shining-border-clockwise 1s linear infinite",
            zIndex: 1,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            top: "2px",
            left: "2px",
            right: "2px",
            bottom: "2px",
            borderRadius: "inherit",
            background: "white",
            zIndex: 2,
          },
          "@keyframes shining-border-clockwise": {
            "0%": {
              transform: "rotate(0deg)",
            },
            "100%": {
              transform: "rotate(360deg)",
            },
          },
        }}
      />
    </BoxFlexVStretch>
  );
}
