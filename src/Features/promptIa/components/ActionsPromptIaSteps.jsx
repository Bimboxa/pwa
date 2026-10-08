import PropTypes from "prop-types";

import { Box, Button } from "@mui/material";

import PROMPT_IA_STEPS from "../utils/promptIaSteps";

// Footer of the « Prompt IA » screens: « Précédent » / « Suivant », and the
// screen's own final action on the last step.
export default function ActionsPromptIaSteps({
  activeStep,
  onBack,
  onNext,
  nextDisabled = false,
  backDisabled = false,
  hideBack = false,
  finalAction,
  steps = PROMPT_IA_STEPS,
  sx,
}) {
  // strings

  const backS = "Précédent";
  const nextS = "Suivant";

  // helpers

  const isLast = activeStep === steps.length - 1;
  const showBack = activeStep > 0 && !hideBack;

  // render

  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        ...sx,
      }}
    >
      <Box>
        {showBack && (
          <Button color="inherit" onClick={onBack} disabled={backDisabled}>
            {backS}
          </Button>
        )}
      </Box>
      {isLast ? (
        finalAction
      ) : (
        <Button
          variant="contained"
          color="secondary"
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextS}
        </Button>
      )}
    </Box>
  );
}

ActionsPromptIaSteps.propTypes = {
  activeStep: PropTypes.number.isRequired,
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  nextDisabled: PropTypes.bool,
  backDisabled: PropTypes.bool,
  hideBack: PropTypes.bool,
  finalAction: PropTypes.node,
  steps: PropTypes.arrayOf(PropTypes.string),
  sx: PropTypes.object,
};
