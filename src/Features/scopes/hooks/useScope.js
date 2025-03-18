import {useSelector} from "react-redux";

export default function useScope(options) {
  // options

  const withProject = options?.withProject;

  // data

  const selectedScopeId = useSelector((state) => state.scopes.selectedScopeId);
  const scopesMap = useSelector((state) => state.scopes.scopesMap);

  const projectsMap = useSelector((s) => s.projects.projectsMap);

  // helpers

  let selectedScope = scopesMap.get(selectedScopeId);

  // join

  if (withProject) {
    selectedScope.project = projectsMap.get(selectedScope.projectId);
  }

  // return

  return selectedScope;
}
