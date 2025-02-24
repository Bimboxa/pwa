import React from "react";

import {Box} from "@mui/material";

export default function BoxFlexVStretch({children, sx}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 1,
        flexGrow: 1,
        minHeight: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
