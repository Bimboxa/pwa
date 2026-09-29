import { Box, Divider } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormProject from "Features/projects/components/FormProject";
import SectionPromptIaProjectInput from "./SectionPromptIaProjectInput";
import SectionPromptIaProjectOutput from "./SectionPromptIaProjectOutput";

import useCreateProjectFromPromptIa from "../hooks/useCreateProjectFromPromptIa";

export default function DialogPromptIaProject({
  open,
  onClose,
  project,
  onProjectChange,
  onCreated,
}) {
  // strings

  const titleS = "Prompt IA";

  // data

  const creation = useCreateProjectFromPromptIa();
  const { running, result, reset, selectCreatedProject } = creation;

  // helpers

  const locked = running || Boolean(result);

  // handlers

  function handleClose() {
    if (running) return;
    if (result) {
      handleDone(result.projectId);
      return;
    }
    reset();
    onClose();
  }

  // The name / number typed by the user win; the model's suggestion only
  // fills an empty field.
  function handleOutputLoaded(data) {
    const name = project?.name?.trim() ? project.name : data.project.name;
    const clientRef = project?.clientRef?.trim()
      ? project.clientRef
      : data.project.clientRef;
    if (name !== project?.name || clientRef !== project?.clientRef)
      onProjectChange({
        ...project,
        ...(name && { name }),
        ...(clientRef && { clientRef }),
      });
  }

  function handleDone(projectId) {
    selectCreatedProject(projectId);
    reset();
    onClose();
    onCreated?.();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} title={titleS} width={560}>
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
        <Box
          sx={{
            ...(locked && { pointerEvents: "none", opacity: 0.6 }),
          }}
        >
          <FormProject project={project} onChange={onProjectChange} />
        </Box>
        <SectionPromptIaProjectInput project={project} disabled={locked} />
        <Divider />
        <SectionPromptIaProjectOutput
          project={project}
          creation={creation}
          onLoaded={handleOutputLoaded}
          onDone={handleDone}
        />
      </Box>
    </DialogGeneric>
  );
}
