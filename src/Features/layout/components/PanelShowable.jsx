import { Box } from "@mui/material";

export default function PanelShowable({ sx, children, show }) {
  // helpers

  const transform = show ? "translateX(0)" : "translateX(calc(100% + 100px))"; // to take into account the rightVerticalMenu

  return (
    <Box sx={{ width: 1, ...(!sx.bottom && { height: 1 }), transform, ...sx }}>
      {children}
    </Box>
  );
}
