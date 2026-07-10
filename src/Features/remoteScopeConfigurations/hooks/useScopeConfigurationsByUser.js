import { useDispatch, useSelector } from "react-redux";

import { setUserConfigurations } from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "../utils/resolveRoute";

export default function useScopeConfigurationsByUser() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);

  // config

  const getByUserConfig =
    appConfig?.features?.remoteScopeConfigurations?.getByUser;
  const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

  // getByUser

  const getByUser = async () => {
    try {
      if (!getByUserConfig)
        throw new Error("missing config (remoteScopeConfigurations.getByUser)");
      if (!userProfile?.idMaster) throw new Error("missing userProfile.idMaster");

      const fetchParams = getByUserConfig.fetchParams;
      if (!fetchParams) throw new Error("missing fetchParams in getByUser config");

      // 1. Resolve URL ({{userProfile.idMaster}} in the route)
      const urlConfig = {
        ...fetchParams.url,
        route: resolveRoute(fetchParams.url.route, { userProfile }),
      };
      const resolvedUrl = resolveUrl(urlConfig);

      // 2. GET request
      console.log("[useScopeConfigurationsByUser] fetching", resolvedUrl);

      const response = await fetch(resolvedUrl, {
        method: fetchParams.method || "GET",
        headers: {
          ...(jwt && { Authorization: `Bearer ${jwt}` }),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for url ${resolvedUrl}`);
      }

      const data = await response.json();

      // 3. Map results
      const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
      const configurations = mapping
        ? items.map((item) => transformObject(item, mapping))
        : items;

      dispatch(setUserConfigurations(configurations));

      return configurations;
    } catch (error) {
      console.error("[useScopeConfigurationsByUser] error", error);
      throw error;
    }
  };

  return getByUser;
}
