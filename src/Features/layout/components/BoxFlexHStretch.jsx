import React from "react";

import {Box} from "@mui/material";

export default function BoxFlexHStretch({children, sx}) {
  return (
    <Box
      sx={{
        display: "flex",
        width: 1,
        minWidth: 0,
        flexGrow: 1,
        minHeight: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
