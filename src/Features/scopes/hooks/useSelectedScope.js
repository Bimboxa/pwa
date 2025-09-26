import { useMemo } from "react";
import { useSelector } from "react-redux";
import useScopes from "./useScopes";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

export default function useSelectedScope(options) {
  // options

  const withProject = options?.withProject;

  // data

  const selectedScopeId = useSelector((state) => state.scopes.selectedScopeId);

  const { value: project, updatedAt: projectUpdatedAt } = useSelectedProject();

  const selectedProjectId = useSelector(
    (state) => state.projects.selectedProjectId
  );

  const {
    value: scopes,
    loading,
    updatedAt: scopesUpdatedAt,
  } = useScopes({
    filterByProjectId: selectedProjectId,
  });

  // helpers

  let selectedScope = useMemo(() => {
    let scope = scopes?.find((s) => s.id === selectedScopeId);
    if (withProject) scope = { ...scope, project };
    return scope;
  }, [
    scopesUpdatedAt,
    selectedScopeId,
    withProject,
    project?.updatedAt,
    scopes?.length,
  ]); // Recompute only when scopes, selectedScopeId, withProject, or project changes

  // return

  return { value: selectedScope, loading: false, updatedAt: scopesUpdatedAt };
}
