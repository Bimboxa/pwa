import { useCallback, useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setProjectConfigurations } from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useGetProjectScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useGetProjectScopeConfigurations";
import normalizeProjectIdMaster from "../utils/normalizeProjectIdMaster";

// Fetches the remote scope configurations of the selected dashboard item
// and stores them in Redux, where useDashboardProjectItems merges them into
// the project items (right panel rows + Krto counts).
//
// The endpoint strategy (ByProject, then SearchAndFilters by clientRef) lives
// in useGetProjectScopeConfigurations.

export default function useFetchProjectScopeConfigurations(item) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const getProjectScopeConfigurations = useGetProjectScopeConfigurations();

  const getByProjectConfig =
    appConfig?.features?.remoteScopeConfigurations?.getByProject;
  const searchConfig =
    appConfig?.features?.remoteScopeConfigurations?.searchAndFilters;

  const idMaster = normalizeProjectIdMaster(item?.idMaster);
  const clientRef = item?.clientRef ? String(item.clientRef) : null;
  const projectId = item?.projectId ? String(item.projectId) : null;
  const canFetch = Boolean(
    jwt && ((idMaster && getByProjectConfig) || (clientRef && searchConfig))
  );

  // state

  const [loading, setLoading] = useState(false);

  // fetch

  const fetchConfigs = useCallback(async () => {
    if (!canFetch) return;
    try {
      setLoading(true);

      const configurations = await getProjectScopeConfigurations({
        idMaster,
        clientRef,
        projectId,
      });

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
  }, [canFetch, idMaster, clientRef, projectId, jwt]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return { loading, canFetch, refresh: fetchConfigs };
}
