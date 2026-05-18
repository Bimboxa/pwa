import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import usePushRemoteScopeConfiguration from "./usePushRemoteScopeConfiguration";

let isFirstSaveInFlight = false;

export default function useTriggerInitialScopeSaveIfNeeded() {
  const dispatch = useDispatch();
  const push = usePushRemoteScopeConfiguration();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const lastRemoteConfiguration = useSelector(
    (s) => s.remoteScopeConfigurations.lastRemoteConfiguration
  );
  const lastSyncedRemoteConfigurationVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );

  return async () => {
    if (isFirstSaveInFlight) return;
    if (lastRemoteConfiguration !== null) return;
    if (lastSyncedRemoteConfigurationVersion !== null) return;

    // Do not create the initial remote version until the project has at least
    // one baseMap. A scope with only scope/listings/entities rows is empty and
    // must not be pushed (a baseMap listing alone does not count).
    if (!projectId) return;
    const baseMapCount = await db.baseMaps
      .where("projectId")
      .equals(projectId)
      .filter((r) => !r.deletedAt)
      .count();
    if (baseMapCount === 0) return;

    isFirstSaveInFlight = true;
    push()
      .catch((error) => {
        console.error("[useTriggerInitialScopeSaveIfNeeded] error", error);
        dispatch(
          setToaster({
            message: "Echec lors de l'enregistrement",
            severity: "error",
          })
        );
      })
      .finally(() => {
        isFirstSaveInFlight = false;
      });
  };
}
