import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedScopeId } from "../scopesSlice";

import db from "App/db/db";

import getLastScopeIdByProject from "Features/init/services/getLastScopeIdByProject";
import setLastScopeIdForProject from "Features/init/services/setLastScopeIdForProject";
import sortScopes from "../utils/sortScopes";

export const SCOPE_STATUS = {
  RESOLVING: "RESOLVING",
  READY: "READY",
  NO_PROJECT: "NO_PROJECT",
  NO_SCOPE: "NO_SCOPE",
};

// Single source of truth for "is a valid scope selected?". A scope is valid
// when it exists in Dexie AND belongs to the selected project. When it is
// not, the hook re-selects the project's last opened scope (else the first
// one in display order); a project with no scope ends in NO_SCOPE with the
// selection cleared, so the write guards block. Modules must only render in
// READY (see ScopeGate).
export default function useEnsureSelectedScope() {
  const dispatch = useDispatch();

  // data

  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const initSelectProjectDone = useSelector(
    (s) => s.projects.initSelectProjectDone
  );

  // The result is tagged with the project it was computed for: useLiveQuery
  // keeps returning the previous project's scopes while the new query runs,
  // and acting on that stale list would re-select a scope of the old project.
  const result = useLiveQuery(async () => {
    if (!selectedProjectId) return { projectId: null, scopes: [] };
    const scopes = await db.scopes
      .where("projectId")
      .equals(selectedProjectId)
      .toArray();
    return { projectId: selectedProjectId, scopes: sortScopes(scopes) };
  }, [selectedProjectId]);

  // helpers

  const scopes =
    result && result.projectId === selectedProjectId ? result.scopes : null;
  const scopeIdsKey = scopes ? scopes.map((s) => s.id).join("|") : null;
  const isValid = Boolean(
    selectedScopeId && scopes?.some((s) => s.id === selectedScopeId)
  );

  let status = SCOPE_STATUS.RESOLVING;
  if (initSelectProjectDone && !selectedProjectId) {
    status = SCOPE_STATUS.NO_PROJECT;
  } else if (initSelectProjectDone && scopes) {
    if (isValid) status = SCOPE_STATUS.READY;
    else if (scopes.length === 0 && !selectedScopeId)
      status = SCOPE_STATUS.NO_SCOPE;
  }

  // effect - fix an invalid selection

  useEffect(() => {
    if (!initSelectProjectDone || !selectedProjectId || !scopes) return;

    if (isValid) {
      setLastScopeIdForProject(selectedProjectId, selectedScopeId);
      return;
    }

    let cancelled = false;
    (async () => {
      // A scope created a moment ago is selected before the live query sees
      // it: check the row itself before overriding the selection.
      if (selectedScopeId) {
        const row = await db.scopes.get(selectedScopeId);
        if (cancelled) return;
        if (row && row.projectId === selectedProjectId) return;
      }
      const lastScopeId = getLastScopeIdByProject(selectedProjectId);
      const pick =
        scopes.find((s) => s.id === lastScopeId) ?? scopes[0] ?? null;
      const pickId = pick?.id ?? null;
      if (pickId !== selectedScopeId) dispatch(setSelectedScopeId(pickId));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    initSelectProjectDone,
    selectedProjectId,
    selectedScopeId,
    scopeIdsKey,
    isValid,
  ]);

  // return

  return { status };
}
