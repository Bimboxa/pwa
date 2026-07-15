import { useCallback, useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setProjectConfigurations } from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeConfigurationsByProject from "Features/remoteScopeConfigurations/hooks/useScopeConfigurationsByProject";

// Fetches the remote scope configurations (ByProject) of the selected
// dashboard item and stores them in Redux, where useDashboardProjectItems
// merges them into the project items (right panel rows + Krto counts).

export default function useFetchProjectScopeConfigurations(item) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const getByProject = useScopeConfigurationsByProject();

  const getByProjectConfig =
    appConfig?.features?.remoteScopeConfigurations?.getByProject;

  const idMaster = item?.idMaster ? String(item.idMaster) : null;
  const canFetch = Boolean(idMaster && jwt && getByProjectConfig);

  // state

  const [loading, setLoading] = useState(false);

  // fetch

  const fetchConfigs = useCallback(async () => {
    if (!canFetch) return;
    try {
      setLoading(true);
      const configurations = await getByProject({
        project: { idMaster },
      });
      dispatch(
        setProjectConfigurations({
          idMaster,
          configurations: (configurations ?? []).map((config) => ({
            ...config,
            projectIdMaster: idMaster,
          })),
        })
      );
    } catch (error) {
      // endpoint may not be live yet — degrade silently
      console.error("[dashboard] fetch project scopes error", error);
    } finally {
      setLoading(false);
    }
  }, [canFetch, idMaster, jwt]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return { loading, canFetch, refresh: fetchConfigs };
}
