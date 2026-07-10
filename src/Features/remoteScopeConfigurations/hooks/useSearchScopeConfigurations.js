import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveRequestBody from "Features/appConfig/utils/resolveRequestBody";
import transformObject from "Features/misc/utils/transformObject";

export default function useSearchScopeConfigurations() {
  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);

  // config

  const searchConfig =
    appConfig?.features?.remoteScopeConfigurations?.searchAndFilters;
  const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

  // search

  const search = async ({ searchValue } = {}) => {
    try {
      if (!searchConfig)
        throw new Error(
          "missing config (remoteScopeConfigurations.searchAndFilters)"
        );
      if (!searchValue) return [];

      const fetchParams = searchConfig.fetchParams;
      if (!fetchParams)
        throw new Error("missing fetchParams in searchAndFilters config");

      const resolvedUrl = resolveUrl(fetchParams.url);
      const resolvedBody = resolveRequestBody(fetchParams.body, {
        searchValue,
        userProfile,
      });

      const response = await fetch(resolvedUrl, {
        method: fetchParams.method || "POST",
        headers: {
          ...(jwt && { Authorization: `Bearer ${jwt}` }),
          "Content-Type": "application/json",
        },
        body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for url ${resolvedUrl}`);
      }

      const data = await response.json();

      const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
      const configurations = mapping
        ? items.map((item) => transformObject(item, mapping))
        : items;

      return configurations;
    } catch (error) {
      console.error("[useSearchScopeConfigurations] error", error);
      return [];
    }
  };

  return search;
}
