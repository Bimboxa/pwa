import React from "react";

import { Box } from "@mui/material";

export default function BoxFlexH({ children, sx }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
