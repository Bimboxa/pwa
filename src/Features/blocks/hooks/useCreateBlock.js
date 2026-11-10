import { useSelector } from "react-redux";

import createBlockService from "../services/createBlockService";

// Returns async ({label}) => block | null (no project / scope selected).
export default function useCreateBlock() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // main

  return async function createBlock({ label }) {
    if (!projectId || !scopeId) return null;
    return createBlockService({ projectId, scopeId, label });
  };
}
