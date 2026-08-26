import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveBodyTemplate from "Features/appConfig/utils/resolveBodyTemplate";

// Updates the denormalized project fields (projectName, projectNum) on every
// remote scopeConfiguration of a project, in ONE call. Configs are matched by
// projectIdClient (immutable client project id). Metadata only — no zip
// re-upload. No-ops gracefully when the `updateProject` route is not
// configured (remoteScopeConfigurations.updateProject).

export default function useUpdateProjectScopeConfigurations() {
  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);

  // config

  const updateConfig =
    appConfig?.features?.remoteScopeConfigurations?.updateProject;

  // update

  // project = { id, name, clientRef } — id is the immutable client id
  // (selector), name / clientRef the values to write.
  const updateRemote = async ({ project }) => {
    const fetchParams = updateConfig?.fetchParams;
    if (!fetchParams) return null; // endpoint not configured — degrade silently

    const resolvedUrl = resolveUrl(fetchParams.url);
    const body = resolveBodyTemplate(fetchParams.body, { project });

    console.log("[useUpdateProjectScopeConfigurations] body", body);

    const response = await fetch(resolvedUrl, {
      method: fetchParams.method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`UpdateProject HTTP ${response.status} (${resolvedUrl})`);
    }

    return response.json().catch(() => null);
  };

  return updateRemote;
}
