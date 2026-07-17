import { useDispatch, useSelector } from "react-redux";

import {
  setLastSyncedRemoteConfigurationVersion,
  setLastSyncAt,
  setPushing,
} from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveBodyTemplate from "Features/appConfig/utils/resolveBodyTemplate";
import createKrtoZip from "Features/krtoFile/services/createKrtoZip";
import resolveRoute from "../utils/resolveRoute";

import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

export default function usePushRemoteScopeConfiguration() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  let userProfile = useSelector((s) => s.auth.userProfile);
  const { value: scope } = useSelectedScope();
  let { value: project } = useSelectedProject();

  // helpers

  project = { ...project, type: project?.type ?? "PROJECT" };

  const debugAuth = getDebugAuthFromLocalStorage();
  userProfile = {
    ...userProfile,
    trigram: userProfile?.trigram ?? debugAuth?.trigram,
    idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster,
  };

  // config

  const pushConfig = appConfig?.features?.remoteScopeConfigurations?.push;

  // push

  const push = async (existingFile) => {
    dispatch(setPushing(true));
    try {
      if (!pushConfig)
        throw new Error(
          "Push config manquante (remoteScopeConfigurations.push)"
        );
      if (!scope) throw new Error("Aucun scope sélectionné");
      if (!project) throw new Error("Aucun projet sélectionné");

      const fetchParams = pushConfig.fetchParams;
      if (!fetchParams)
        throw new Error("fetchParams manquant dans la config push");

      // 1. Créer le fichier ZIP (or use pre-generated one)
      const file = existingFile ?? (await createKrtoZip(scope.id));

      // 2. Résoudre l'URL (avec {{scopeId}} dans la route)
      const urlConfig = {
        ...fetchParams.url,
        route: resolveRoute(fetchParams.url.route, { scopeId: scope.id }),
      };
      const resolvedUrl = resolveUrl(urlConfig);

      // 3. Construire le body en FormData
      const context = { scope, project, userProfile, file };
      const body = resolveBodyTemplate(fetchParams.body, context);
      const formData = new FormData();
      Object.entries(body).forEach(([key, value]) =>
        formData.append(key, value)
      );

      // debug : log du FormData en objet lisible
      const debugBody = {};
      for (const [key, value] of formData.entries()) {
        debugBody[key] =
          value instanceof File
            ? `[File: ${value.name}, ${value.size} bytes, ${value.type}]`
            : value;
      }
      console.log("[usePushRemoteScopeConfiguration] formData", debugBody);

      // 4. Requête POST
      console.log("[usePushRemoteScopeConfiguration] pushing to", resolvedUrl);

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

      const data = await response.json();
      console.log("[usePushRemoteScopeConfiguration] response", data);

      // 5. Mettre à jour la version synchronisée
      if (data?.version) {
        dispatch(setLastSyncedRemoteConfigurationVersion(data.version));
      }
      dispatch(setLastSyncAt(Date.now()));

      return data;
    } catch (error) {
      console.error("[usePushRemoteScopeConfiguration] error", error);
      throw error;
    } finally {
      dispatch(setPushing(false));
    }
  };

  return push;
}
