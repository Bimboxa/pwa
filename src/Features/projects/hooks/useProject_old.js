import {useSelector} from "react-redux";

import useSelectedProject from "./useSelectedProject";

export default function useProject(options) {
  // options

  const forceNew = options?.forceNew;

  // main

  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);
  const newProject = useSelector((s) => s.projects.newProject);
  const editedProject = useSelector((s) => s.projects.editedProject);
  const isEditingProject = useSelector((s) => s.projects.isEditingProject);

  const {value: selectedProject, loading} = useSelectedProject();

  let project = loading ? null : selectedProject;

  if (!selectedProjectId) {
    if (isEditingProject) {
      project = editedProject;
    } else {
      project = newProject;
    }
  }

  if (forceNew) {
    project = newProject;
  }

  return {value: project, loading};
}
