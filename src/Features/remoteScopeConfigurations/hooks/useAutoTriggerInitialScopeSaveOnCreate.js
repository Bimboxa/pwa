import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setPendingInitialSaveScopeId } from "../remoteScopeConfigurationsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useTriggerInitialScopeSaveIfNeeded from "./useTriggerInitialScopeSaveIfNeeded";

export default function useAutoTriggerInitialScopeSaveOnCreate() {
  const dispatch = useDispatch();

  const pendingScopeId = useSelector(
    (s) => s.remoteScopeConfigurations.pendingInitialSaveScopeId
  );
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: scope } = useSelectedScope();
  const { value: project } = useSelectedProject();

  const trigger = useTriggerInitialScopeSaveIfNeeded();

  useEffect(() => {
    if (!pendingScopeId) return;
    if (selectedScopeId !== pendingScopeId) return;
    if (scope?.id !== pendingScopeId) return; // scope resolved from db
    if (!project) return;

    trigger();
    dispatch(setPendingInitialSaveScopeId(null));
  }, [pendingScopeId, selectedScopeId, scope?.id, project?.id]);
}
