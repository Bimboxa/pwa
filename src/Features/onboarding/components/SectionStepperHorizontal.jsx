import { useSelector, useDispatch } from "react-redux";

import { setStep } from "../onboardingSlice";

import { Box, Stepper, Step, StepLabel, StepButton } from "@mui/material";

export default function SectionStepperHorizontal() {
  const dispatch = useDispatch();

  // const

  const steps = ["CREATE_PROJECT", "CREATE_MAP", "CREATE_LISTINGS"];

  // data

  const step = useSelector((s) => s.onboarding.step);

  const projectName = useSelector((s) => s.onboarding.projectName);
  const mapName = useSelector((s) => s.onboarding.mapName);
  const issuesListingName = useSelector((s) => s.onboarding.issuesListingName);

  // helpers

  const labelByStep = {
    CREATE_PROJECT: "Créer un projet",
    CREATE_MAP: "Ajoutez un fond de plan",
    CREATE_LISTINGS: "Sélectionnez des listes d'objets",
  };

  // helpers - completedByStep

  const completedByStep = {
    CREATE_PROJECT: Boolean(projectName),
    CREATE_MAP: Boolean(mapName),
    CREATE_LISTINGS: Boolean(issuesListingName),
  };

  // handlers

  function handleStep(index) {
    dispatch(setStep(steps[index]));
  }

  // render

  return (
    <Box sx={{ width: 1, p: 6 }}>
      <Stepper activeStep={steps.indexOf(step)} alternativeLabel nonLinear>
        {steps.map((step, index) => {
          const label = labelByStep[step];
          const completed = completedByStep[step];
          return (
            <Step key={label} completed={completed}>
              <StepButton color="inherit" onClick={() => handleStep(index)}>
                {label}
              </StepButton>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
