import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import useScopes from "./useScopes";
import { setSelectedScopeId } from "../scopesSlice";

export default function useAutoSelectScopeId() {
  const dispatch = useDispatch();

  // data

  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const { value: scopes, updatedAt: scopesUpdatedAt } = useScopes({
    filterByProjectId: selectedProjectId,
  });

  // effect

  useEffect(() => {
    if (!selectedProjectId || !scopes || scopes.length === 0) return;

    const currentBelongsToProject = scopes.some(
      (s) => s.id === selectedScopeId
    );
    if (currentBelongsToProject) return;

    dispatch(setSelectedScopeId(scopes[0].id));
  }, [selectedProjectId, scopesUpdatedAt, selectedScopeId, scopes?.length]);
}
