import { useDispatch, useSelector } from "react-redux";

import { setDailyScopes, setDailyScopesDate } from "../dailyScopesSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "Features/remoteScopeConfigurations/utils/resolveRoute";
import getLocalDateString from "../utils/getLocalDateString";

// Module-level so every hook instance (init hook + section) shares the same
// request sequence: a late response never overwrites a more recent day.
let lastRequestId = 0;

export default function useDailyScopes() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const dailyScopes = useSelector((s) => s.dailyScopes.items);
  const dailyScopesDate = useSelector((s) => s.dailyScopes.date);

  // config

  const dailyScopesConfig = appConfig?.features?.dailyScopes;
  const mapping = dailyScopesConfig?.mapping;

  // fetch

  const fetchDailyScopes = async (date) => {
    const dateS = date ?? getLocalDateString();
    const requestId = ++lastRequestId;
    const isLatest = () => requestId === lastRequestId;

    // The selected day follows the user's choice immediately, whatever the
    // request outcome.
    dispatch(setDailyScopesDate(dateS));

    try {
      const fetchParams = dailyScopesConfig?.getByDay?.fetchParams;
      if (!fetchParams) return [];

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

      // No scopes that day: empty list, not an error.
      if (response.status === 204 || response.status === 404) {
        if (isLatest()) dispatch(setDailyScopes({ items: [], date: dateS }));
        return [];
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for url ${resolvedUrl}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const _dailyScopes = mapping
        ? items.map((item) => transformObject(item, mapping))
        : items;
      if (isLatest()) {
        dispatch(setDailyScopes({ items: _dailyScopes, date: dateS }));
      }
      return _dailyScopes;
    } catch (error) {
      // endpoint may not be live yet — degrade silently, but never show
      // another day's items under the requested date.
      console.error("[useDailyScopes] fetch error", error);
      if (isLatest()) dispatch(setDailyScopes({ items: [], date: dateS }));
      return null;
    }
  };

  return { dailyScopes, dailyScopesDate, fetchDailyScopes };
}
