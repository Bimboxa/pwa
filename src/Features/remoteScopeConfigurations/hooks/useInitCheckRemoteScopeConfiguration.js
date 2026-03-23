import { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  setLastRemoteConfiguration,
  restoreSyncedVersionFromStorage,
} from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "../utils/resolveRoute";

export default function useInitCheckRemoteVersion() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const lastSyncedVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );

  // state

  const [showDialog, setShowDialog] = useState(false);
  const [remoteConfig, setRemoteConfig] = useState(null);

  // config

  const pullConfig = appConfig?.features?.remoteScopeConfigurations?.pull;
  const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

  // effect

  useEffect(() => {
    if (!jwt || !scopeId || !pullConfig) return;

    // Restore synced version from localStorage first
    dispatch(restoreSyncedVersionFromStorage(scopeId));

    let cancelled = false;

    async function check() {
      try {
        const fetchParams = pullConfig.fetchParams;
        if (!fetchParams) return;

        const urlConfig = {
          ...fetchParams.url,
          route: resolveRoute(fetchParams.url.route, { scopeId }),
        };
        const resolvedUrl = resolveUrl(urlConfig);

        const response = await fetch(resolvedUrl, {
          method: fetchParams.method || "GET",
          headers: {
            ...(jwt && { Authorization: `Bearer ${jwt}` }),
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const configuration = mapping ? transformObject(data, mapping) : data;

        if (cancelled) return;

        dispatch(setLastRemoteConfiguration(configuration));

        // Read synced version from localStorage directly (Redux may not be updated yet)
        const storedRaw = localStorage.getItem(`syncedVersion_${scopeId}`);
        const storedVersion = storedRaw ? Number(storedRaw) : null;

        if (
          configuration?.version &&
          (storedVersion == null || configuration.version > storedVersion)
        ) {
          setRemoteConfig(configuration);
          setShowDialog(true);
        }
      } catch (error) {
        console.error("[useInitCheckRemoteVersion] error", error);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [jwt, scopeId, pullConfig]);

  // handlers

  const handleClose = useCallback(() => {
    setShowDialog(false);
  }, []);

  return { showDialog, remoteConfig, onClose: handleClose };
}
