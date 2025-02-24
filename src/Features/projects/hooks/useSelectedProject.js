import {useSelector} from "react-redux";

export default function useSelectedProject() {
  const id = useSelector((s) => s.projects.selectedProjectId);
  const projectsMap = useSelector((s) => s.projects.projectsMap);

  let project = projectsMap[id];

  return project;
}
