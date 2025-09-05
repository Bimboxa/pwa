import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";
import HeaderScopeCreator from "./HeaderScopeCreator";
import SectionSteps from "./SectionSteps";
import SectionStepDetail from "./SectionStepDetail";

export default function PageScopeCreator() {
  // data

  const width = useSelector((s) => s.scopeCreator.stepPanelWidth);

  return (
    <BoxFlexVStretch>
      <HeaderScopeCreator />
      <BoxFlexHStretch>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            width,
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <SectionSteps />
        </Box>
        <BoxFlexVStretch sx={{ flex: 1, bgcolor: "background.default" }}>
          <SectionStepDetail />
        </BoxFlexVStretch>
      </BoxFlexHStretch>
    </BoxFlexVStretch>
  );
}
