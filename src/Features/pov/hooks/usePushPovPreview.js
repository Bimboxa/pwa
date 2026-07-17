import { useSelector } from "react-redux";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveBodyTemplate from "Features/appConfig/utils/resolveBodyTemplate";
import transformObject from "Features/misc/utils/transformObject";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

// Shares (or re-shares) a POV preview to the backend — multipart upsert keyed
// on pov.id, see docs/backend/POV_PREVIEWS_API.md. The response is mapped via
// features.povPreviews.mapping and the master fields (idMaster,
// imageUrlMaster) are written back on the local record.
export default function usePushPovPreview() {
  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  let userProfile = useSelector((s) => s.auth.userProfile);
  const { value: scope } = useSelectedScope();
  const { value: project } = useSelectedProject();

  // helpers

  const debugAuth = getDebugAuthFromLocalStorage();
  userProfile = {
    ...userProfile,
    idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster,
  };

  // config

  const povPreviewsConfig = appConfig?.features?.povPreviews;

  // push

  return async function pushPovPreview(pov) {
    try {
      const fetchParams = povPreviewsConfig?.push?.fetchParams;
      if (!fetchParams)
        throw new Error("Config manquante (povPreviews.push)");
      if (!pov?.id) throw new Error("POV manquant");
      if (!scope?.id) throw new Error("Aucun scope sélectionné");
      if (!project?.idMaster) throw new Error("project.idMaster manquant");

      // 1. Image de prévisualisation depuis db.files
      const fileName = pov.image?.fileName;
      const fileRecord = fileName ? await db.files.get(fileName) : null;
      if (!fileRecord?.fileArrayBuffer)
        throw new Error("Image de prévisualisation introuvable");
      const file = new File([fileRecord.fileArrayBuffer], fileName, {
        type: fileRecord.fileMime || "image/png",
      });

      // 2. URL + body FormData depuis le template de la config
      const resolvedUrl = resolveUrl(fetchParams.url);
      const body = resolveBodyTemplate(fetchParams.body, {
        pov,
        scope,
        project,
        userProfile,
        file,
      });
      const formData = new FormData();
      Object.entries(body).forEach(([key, value]) =>
        formData.append(key, value)
      );

      // 3. Requête POST
      console.log("[usePushPovPreview] pushing to", resolvedUrl);

      const response = await fetch(resolvedUrl, {
        method: fetchParams.method || "POST",
        headers: {
          ...(jwt && { Authorization: `Bearer ${jwt}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Erreur HTTP: ${response.status} pour l'url ${resolvedUrl}`
        );
      }

      const data = await response.json().catch(() => null);
      console.log("[usePushPovPreview] response", data);

      // 4. Mapper la réponse (povId → idMaster, povImageUrl → imageUrlMaster)
      const mapping = povPreviewsConfig?.mapping;
      const mapped = mapping && data ? transformObject(data, mapping) : {};

      const fields = { sharedAt: Date.now() };
      if (mapped?.idMaster) fields.idMaster = mapped.idMaster;
      if (mapped?.imageUrlMaster) fields.imageUrlMaster = mapped.imageUrlMaster;
      await db.povs.update(pov.id, fields);

      return mapped;
    } catch (error) {
      console.error("[usePushPovPreview] error", error);
      throw error;
    }
  };
}
