import PropTypes from "prop-types";

import { Step, StepButton, Stepper } from "@mui/material";

import PROMPT_IA_STEPS from "../utils/promptIaSteps";

// Header of the « Prompt IA » screens: context → zip → result. The steps are
// free to click — a user who already holds the AI's answer goes straight to
// the last one.
export default function StepperPromptIa({
  activeStep,
  onStepChange,
  completed = [],
  disabled = false,
  sx,
}) {
  // render

  return (
    <Stepper
      nonLinear
      activeStep={activeStep}
      sx={{
        width: 1,
        "& .MuiStepLabel-label": { fontSize: 13 },
        ...sx,
      }}
    >
      {PROMPT_IA_STEPS.map((label, index) => (
        <Step key={label} completed={Boolean(completed[index])}>
          <StepButton
            color="inherit"
            disabled={disabled}
            onClick={() => onStepChange(index)}
          >
            {label}
          </StepButton>
        </Step>
      ))}
    </Stepper>
  );
}

StepperPromptIa.propTypes = {
  activeStep: PropTypes.number.isRequired,
  onStepChange: PropTypes.func.isRequired,
  completed: PropTypes.arrayOf(PropTypes.bool),
  disabled: PropTypes.bool,
  sx: PropTypes.object,
};
