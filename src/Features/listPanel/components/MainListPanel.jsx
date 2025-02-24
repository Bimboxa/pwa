import React from "react";

import {Box} from "@mui/material";

import SectionShapesInListPanel from "Features/shapes/components/SectionShapesInListPanel";

export default function MainListPanel() {
  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.main",
      }}
    >
      <SectionShapesInListPanel />
    </Box>
  );
}
