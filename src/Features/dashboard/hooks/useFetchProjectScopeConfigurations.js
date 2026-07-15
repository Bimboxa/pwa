import { useCallback, useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setProjectConfigurations } from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeConfigurationsByProject from "Features/remoteScopeConfigurations/hooks/useScopeConfigurationsByProject";
import useSearchScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useSearchScopeConfigurations";

// Fetches the remote scope configurations of the selected dashboard item
// and stores them in Redux, where useDashboardProjectItems merges them into
// the project items (right panel rows + Krto counts).
//
// Uses the ByProject endpoint when the project has an idMaster (chantier
// IdObject); falls back to SearchAndFilters with the clientRef (projectNum)
// otherwise — the backend matches configurations on projectNum.

export default function useFetchProjectScopeConfigurations(item) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const getByProject = useScopeConfigurationsByProject();
  const searchConfigurations = useSearchScopeConfigurations();

  const getByProjectConfig =
    appConfig?.features?.remoteScopeConfigurations?.getByProject;
  const searchConfig =
    appConfig?.features?.remoteScopeConfigurations?.searchAndFilters;

  const idMaster = item?.idMaster ? String(item.idMaster) : null;
  const clientRef = item?.clientRef ? String(item.clientRef) : null;
  const canFetch = Boolean(
    jwt &&
      ((idMaster && getByProjectConfig) || (clientRef && searchConfig))
  );

  // state

  const [loading, setLoading] = useState(false);

  // fetch

  const fetchConfigs = useCallback(async () => {
    if (!canFetch) return;
    try {
      setLoading(true);

      let configurations;
      if (idMaster && getByProjectConfig) {
        configurations = await getByProject({ project: { idMaster } });
      } else {
        // no idMaster — search by clientRef (backend matches projectNum)
        const results = await searchConfigurations({
          searchValue: clientRef,
        });
        configurations = (results ?? []).filter(
          (config) => String(config.projectClientRef) === clientRef
        );
      }

      dispatch(
        setProjectConfigurations({
          idMaster: idMaster ?? clientRef,
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
  }, [canFetch, idMaster, clientRef, jwt]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return { loading, canFetch, refresh: fetchConfigs };
}
