import { useSelector } from "react-redux";

import { Box, Stepper, Step, StepLabel } from "@mui/material";

export default function PanelCreateDataVariantHorizontal() {
  // const

  const steps = ["CREATE_PROJECT", "CREATE_MAP", "CREATE_LISTINGS"];

  // data

  const step = useSelector((s) => s.onboarding.step);

  // helpers

  const labelByStep = {
    CREATE_PROJECT: "Créer un projet",
    CREATE_MAP: "Ajoutez un fond de plan",
    CREATE_LISTINGS: "Sélectionnez des listes d'objets",
  };

  const label = labelByStep[step];

  // render

  return (
    <Box sx={{ width: 1, p: 2 }}>
      <SectionStepperHorizonta></SectionStepperHorizonta>
    </Box>
  );
}
