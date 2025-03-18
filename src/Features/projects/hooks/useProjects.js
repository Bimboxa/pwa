import {useSelector} from "react-redux";

export default function useProjects() {
  // data

  const projectsMap = useSelector((s) => s.projects.projectsMap);

  // helpers

  let projects = Array.from(projectsMap.values());

  // return

  return projects;
}
