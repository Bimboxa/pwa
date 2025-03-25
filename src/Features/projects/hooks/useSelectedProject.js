import {useSelector} from "react-redux";
import useProjects from "./useProjects";

export default function useSelectedProject() {
  const id = useSelector((s) => s.projects.selectedProjectId);
  const {value: projects, loading} = useProjects();

  let project = projects?.find((p) => p.id === id);

  return {value: project, loading};
}
