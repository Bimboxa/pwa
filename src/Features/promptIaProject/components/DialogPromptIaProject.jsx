import DialogGeneric from "Features/layout/components/DialogGeneric";
import ContentPromptIaProject from "./ContentPromptIaProject";

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
      <ContentPromptIaProject
        project={project}
        onProjectChange={onProjectChange}
        creation={creation}
        onOutputLoaded={handleOutputLoaded}
        onDone={handleDone}
      />
    </DialogGeneric>
  );
}
