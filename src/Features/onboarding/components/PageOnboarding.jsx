import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setOpenPanelCreateData } from "../onboardingSlice";

import { useMediaQuery } from "@mui/material";
import theme from "Styles/theme";

import { Typography, Box } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import BlockStartButtons from "./BlockStartButtons";
import PanelCreateData from "./PanelCreateData";
import ImageAnimatedMap from "./ImageAnimatedMap";

export default function PageOnboarding() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const titleS = `Des plans de repérage,
    sans stabylo,
    pour les pros.`;

  // data

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const openPanelCreateData = useSelector(
    (s) => s.onboarding.openPanelCreateData
  );

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
          zIndex: 1,
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
            onShowCreateData={() => dispatch(setOpenPanelCreateData(true))}
            //onShowCreateData={() => navigate("/dashboard")}
          />
        </Box>
      </Box>
    </PageGeneric>
  );
}
