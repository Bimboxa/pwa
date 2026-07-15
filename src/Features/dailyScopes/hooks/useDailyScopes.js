import { useDispatch, useSelector } from "react-redux";

import { setDailyScopes } from "../dailyScopesSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "Features/remoteScopeConfigurations/utils/resolveRoute";
import getLocalDateString from "../utils/getLocalDateString";

export default function useDailyScopes() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const dailyScopes = useSelector((s) => s.dailyScopes.items);

  // config

  const dailyScopesConfig = appConfig?.features?.dailyScopes;
  const mapping = dailyScopesConfig?.mapping;

  // fetch

  const fetchDailyScopes = async (date) => {
    try {
      const fetchParams = dailyScopesConfig?.getByDay?.fetchParams;
      if (!fetchParams) return [];

      const dateS = date ?? getLocalDateString();
      const urlConfig = {
        ...fetchParams.url,
        route: resolveRoute(fetchParams.url.route, { date: dateS }),
      };
      const resolvedUrl = resolveUrl(urlConfig);

      const response = await fetch(resolvedUrl, {
        method: fetchParams.method || "GET",
        headers: {
          ...(jwt && { Authorization: `Bearer ${jwt}` }),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for url ${resolvedUrl}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const _dailyScopes = mapping
        ? items.map((item) => transformObject(item, mapping))
        : items;
      dispatch(setDailyScopes(_dailyScopes));
      return _dailyScopes;
    } catch (error) {
      // endpoint may not be live yet — degrade silently, keep local state
      console.error("[useDailyScopes] fetch error", error);
      return null;
    }
  };

  return { dailyScopes, fetchDailyScopes };
}
