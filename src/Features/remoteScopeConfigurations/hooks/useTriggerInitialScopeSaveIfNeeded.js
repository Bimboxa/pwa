import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import usePushRemoteScopeConfiguration from "./usePushRemoteScopeConfiguration";

let isFirstSaveInFlight = false;

export default function useTriggerInitialScopeSaveIfNeeded() {
  const dispatch = useDispatch();
  const push = usePushRemoteScopeConfiguration();

  const lastRemoteConfiguration = useSelector(
    (s) => s.remoteScopeConfigurations.lastRemoteConfiguration
  );
  const lastSyncedRemoteConfigurationVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );

  return () => {
    if (isFirstSaveInFlight) return;
    if (lastRemoteConfiguration !== null) return;
    if (lastSyncedRemoteConfigurationVersion !== null) return;

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
