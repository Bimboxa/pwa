import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import SectionStepHelper from "./SectionStepHelper";
import SectionStepperHorizontal from "./SectionStepperHorizontal";
import SectionStepCreateProject from "./SectionStepCreateProject";
import SectionStepCreateMap from "./SectionStepCreateMap";
import SectionStepCreateListings from "./SectionStepCreateListings";

export default function PanelCreateDataVariantHorizontal({ onClose }) {
  // data

  const step = useSelector((s) => s.onboarding.step);

  return (
    <Box sx={{ width: 1, height: 1, display: "flex" }}>
      <SectionStepHelper />
      <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <SectionStepperHorizontal />
        {step === "CREATE_PROJECT" && <SectionStepCreateProject />}
        {step === "CREATE_MAP" && <SectionStepCreateMap />}
        {step === "CREATE_LISTINGS" && <SectionStepCreateListings />}
      </Box>
    </Box>
  );
}
