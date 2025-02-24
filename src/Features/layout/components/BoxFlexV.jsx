import React from "react";

import {Box} from "@mui/material";

export default function BoxFlexV({children, sx}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 1,
        height: 1,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
