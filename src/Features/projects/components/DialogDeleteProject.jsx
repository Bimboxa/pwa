import useDeleteProject from "../hooks/useDeleteProject";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function DialogDeleteProject({ open, onClose, projectId }) {
  // data

  const deleteProject = useDeleteProject();
  // handlers

  async function handleDelete() {
    await deleteProject(projectId);
    onClose();
  }

  return (
    <DialogDeleteRessource
      open={open}
      onClose={onClose}
      onConfirmAsync={handleDelete}
    />
  );
}
