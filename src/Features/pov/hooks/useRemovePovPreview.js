import { useSelector } from "react-redux";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveBodyTemplate from "Features/appConfig/utils/resolveBodyTemplate";

// Removes a shared POV preview on the backend (idempotent, see
// docs/backend/POV_PREVIEWS_API.md) and clears the master fields on the
// local record.
export default function useRemovePovPreview() {
  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);

  // config

  const povPreviewsConfig = appConfig?.features?.povPreviews;

  // remove

  return async function removePovPreview(pov) {
    try {
      const fetchParams = povPreviewsConfig?.remove?.fetchParams;
      if (!fetchParams)
        throw new Error("Config manquante (povPreviews.remove)");
      if (!pov?.id) throw new Error("POV manquant");

      const resolvedUrl = resolveUrl(fetchParams.url);
      const body = resolveBodyTemplate(fetchParams.body, { pov });

      console.log("[useRemovePovPreview] removing at", resolvedUrl);

      const response = await fetch(resolvedUrl, {
        method: fetchParams.method || "POST",
        headers: {
          ...(jwt && { Authorization: `Bearer ${jwt}` }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Erreur HTTP: ${response.status} pour l'url ${resolvedUrl}`
        );
      }

      await db.povs.update(pov.id, {
        idMaster: null,
        imageUrlMaster: null,
        sharedAt: null,
      });
    } catch (error) {
      console.error("[useRemovePovPreview] error", error);
      throw error;
    }
  };
}
