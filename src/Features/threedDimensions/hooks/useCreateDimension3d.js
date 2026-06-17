import { useSelector } from "react-redux";

import createDimension3dService from "../services/createDimension3dService";

// Returns a `createDimension3d({ a, b })` function that scopes the new cote to
// the currently-selected project + scope (read from Redux at call time).
export default function useCreateDimension3d() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  return async ({ a, b }) => {
    if (!projectId || !scopeId) return null;
    return await createDimension3dService({ projectId, scopeId, a, b });
  };
}
