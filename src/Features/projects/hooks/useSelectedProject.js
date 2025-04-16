import {useSelector} from "react-redux";

export default function useSelectedProject() {
  const id = useSelector((s) => s.projects.selectedProjectId);
  const projectsById = useSelector((s) => s.projects.projectsById);

  const project = projectsById[id];

  return {value: project, loading: false};
}
