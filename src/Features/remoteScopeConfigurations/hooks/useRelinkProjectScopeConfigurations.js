import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveBodyTemplate from "Features/appConfig/utils/resolveBodyTemplate";

// Bulk-updates the denormalized project fields (projectObjectId, projectNum,
// projectType, projectName) on every remote scopeConfiguration of a project,
// in ONE call. Configs are matched by projectIdClient (immutable client
// project id) with the current idMaster/clientRef as fallback for older rows
// pushed before projectIdClient existed. Metadata only — no zip re-upload.
// The backend endpoint is pending: no-ops gracefully when the `relink` route
// is not configured (remoteScopeConfigurations.relink).

export default function useRelinkProjectScopeConfigurations() {
  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);

  // config

  const relinkConfig = appConfig?.features?.remoteScopeConfigurations?.relink;

  // relink

  // project = { id }                              — immutable client id (primary key)
  // current = { idMaster, clientRef }             — BEFORE the change (fallback match)
  // next    = { idMaster, clientRef, type, name } — values to write
  const relink = async ({ project, current, next }) => {
    const fetchParams = relinkConfig?.fetchParams;
    if (!fetchParams) return null; // endpoint not live yet — degrade silently

    const resolvedUrl = resolveUrl(fetchParams.url);
    const body = resolveBodyTemplate(fetchParams.body, {
      project,
      current,
      next,
    });

    console.log("[useRelinkProjectScopeConfigurations] body", body);

    const response = await fetch(resolvedUrl, {
      method: fetchParams.method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Relink HTTP ${response.status} (${resolvedUrl})`);
    }

    return response.json().catch(() => null);
  };

  return relink;
}
