import {useMemo} from "react";
import {useSelector} from "react-redux";
import useProjects from "./useProjects";

export default function useSelectedProject() {
  const id = useSelector((s) => s.projects.selectedProjectId);
  const {value: projects, loading, updatedAt} = useProjects();

  const project = useMemo(() => {
    return projects?.find((p) => p.id === id);
  }, [id, updatedAt]); // Recompute only when projects, id, or updatedAt changes

  return {value: project, loading, updatedAt};
}
