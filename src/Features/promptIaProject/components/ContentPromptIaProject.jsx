import { useState } from "react";

import { Box, CircularProgress } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import StepperPromptIa from "Features/promptIa/components/StepperPromptIa";
import ActionsPromptIaSteps from "Features/promptIa/components/ActionsPromptIaSteps";
import StepPromptIaProjectContext from "./StepPromptIaProjectContext";
import StepPromptIaProjectZip from "./StepPromptIaProjectZip";
import StepPromptIaProjectResult from "./StepPromptIaProjectResult";

import usePromptIaProjectInput from "../hooks/usePromptIaProjectInput";
import usePromptIaProjectOutput from "../hooks/usePromptIaProjectOutput";

// Body of the project « Prompt IA » dialog, in three steps: context (the
// description and the documents), zip (handed to the AI chat), result (the
// zip given back, previewed then created). Mounted with the dialog: its
// state starts afresh at each opening.
export default function ContentPromptIaProject({
  project,
  onProjectChange,
  creation,
  onOutputLoaded,
  onDone,
}) {
  // strings

  const createS = "Créer";
  const closeS = "Fermer";

  // data

  const { create, running, progress, result } = creation;

  // state

  const [step, setStep] = useState(0);
  const input = usePromptIaProjectInput({ project });
  const output = usePromptIaProjectOutput({ onLoaded: onOutputLoaded });

  // helpers

  const locked = running || Boolean(result);
  const hasProject =
    Boolean(project?.name?.trim()) && Boolean(project?.clientRef?.trim());
  const canCreate = Boolean(output.output) && hasProject && !locked;

  const completed = [
    Boolean(input.description.trim()),
    Boolean(input.downloaded),
    Boolean(result),
  ];

  // handlers

  async function handleCreate() {
    if (!canCreate) return;
    const read = output.output;
    await create({
      project,
      data: read.data,
      pdfFilesByPath: read.pdfFilesByPath,
      referenceImageFile: read.referenceImageFile,
      documentFilesByPath: read.documentFilesByPath,
    });
  }

  // render

  return (
    <Box
      sx={{
        width: 1,
        px: 2,
        pb: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        overflowY: "auto",
        maxHeight: "75vh",
      }}
    >
      <StepperPromptIa
        activeStep={step}
        onStepChange={setStep}
        completed={completed}
        disabled={locked}
      />

      <Box sx={{ minHeight: 280 }}>
        {step === 0 && <StepPromptIaProjectContext input={input} />}
        {step === 1 && <StepPromptIaProjectZip input={input} />}
        {step === 2 && (
          <StepPromptIaProjectResult
            project={project}
            onProjectChange={onProjectChange}
            creation={creation}
            output={output}
            hasProject={hasProject}
          />
        )}
      </Box>

      <ActionsPromptIaSteps
        activeStep={step}
        onBack={() => setStep(step - 1)}
        onNext={() => setStep(step + 1)}
        nextDisabled={step === 0 && !input.description.trim()}
        hideBack={locked}
        finalAction={
          result ? (
            <ButtonGeneric
              label={closeS}
              onClick={() => onDone(result.projectId)}
              variant="contained"
              color="secondary"
            />
          ) : (
            <ButtonGeneric
              label={
                running
                  ? `Création… (${progress.done}/${progress.total})`
                  : createS
              }
              onClick={handleCreate}
              variant="contained"
              color="secondary"
              disabled={!canCreate}
              startIcon={
                running ? <CircularProgress size={14} color="inherit" /> : null
              }
            />
          )
        }
      />
    </Box>
  );
}
