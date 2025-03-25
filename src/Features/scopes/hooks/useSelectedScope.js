import {useSelector} from "react-redux";
import useScopes from "./useScopes";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

export default function useSelectedScope(options) {
  // options

  const withProject = options?.withProject;

  // data

  const selectedScopeId = useSelector((state) => state.scopes.selectedScopeId);
  const selectedProjectId = useSelector(
    (state) => state.projects.selectedProjectId
  );

  const {value: scopes, loading} = useScopes({
    filterByProjectId: selectedProjectId,
  });
  const {value: project} = useSelectedProject();

  // helpers

  let selectedScope = scopes?.find((s) => s.id === selectedScopeId);
  if (withProject) selectedScope = {...selectedScope, project};

  // return

  return {value: selectedScope, loading};
}
