import { useState } from "react";

import { useMediaQuery } from "@mui/material";
import theme from "Styles/theme";

import { Typography, Box } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import BlockStartButtons from "./BlockStartButtons";
import PanelCreateData from "./PanelCreateData";
import ImageAnimatedMap from "./ImageAnimatedMap";

export default function PageOnboarding() {
  // strings

  const titleS = `Des plans de repérage,
    sans stabylo,
    pour les pros.`;

  // data

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // state

  const [openPanelCreateData, setOpenPanelCreateData] = useState(false);

  // render - PanelCreateData
  if (openPanelCreateData) {
    return (
      <PageGeneric
        sx={{ alignItems: "center", justifyContent: "center", display: "flex" }}
      >
        <PanelCreateData isMobile={isMobile} />
      </PageGeneric>
    );
  }

  // render - default

  return (
    <PageGeneric
      sx={{
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          position: "absolute",
          bottom: 0,
          left: 0,
          top: 0,
          zIndex: 0,
        }}
      >
        <ImageAnimatedMap />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography
          variant={isMobile ? "h4" : "h1"}
          align="center"
          sx={{ whiteSpace: "pre-line", fontWeight: 700, lineHeight: 1.5 }}
        >
          {titleS}
        </Typography>
        <Box sx={{ mt: 3 }}>
          <BlockStartButtons
            isMobile={isMobile}
            onShowCreateData={() => setOpenPanelCreateData(true)}
          />
        </Box>
      </Box>
    </PageGeneric>
  );
}
