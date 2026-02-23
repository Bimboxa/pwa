import { useDispatch, useSelector } from "react-redux";

import { setLastSyncedRemoteConfigurationVersion } from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveRoute from "../utils/resolveRoute";
import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";

export default function useFetchScopeConfiguration() {
    const dispatch = useDispatch();

    // data

    const appConfig = useAppConfig();
    const jwt = useSelector((s) => s.auth.jwt);
    const lastRemoteConfiguration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);
    const { value: scope } = useSelectedScope();

    // config

    const downloadConfig = appConfig?.features?.remoteScopeConfigurations?.download;

    // fetch — télécharge le ZIP et l'importe dans Dexie

    const fetchConfiguration = async () => {
        try {
            if (!downloadConfig) throw new Error("Download config manquante (remoteScopeConfigurations.download)");
            if (!scope) throw new Error("Aucun scope sélectionné");

            // 1. Résoudre l'URL de téléchargement (avec {{scopeId}} dans la route)
            const fetchParams = downloadConfig.fetchParams;
            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { scopeId: scope.id }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            console.log("[useFetchScopeConfiguration] downloading file", resolvedUrl);

            const fileResponse = await fetch(resolvedUrl, {
                method: fetchParams.method || "GET",
                headers: {
                    ...(jwt && { Authorization: `Bearer ${jwt}` }),
                },
            });

            if (!fileResponse.ok) {
                throw new Error(`Erreur HTTP: ${fileResponse.status} pour le fichier ${resolvedUrl}`);
            }

            const fileBlob = await fileResponse.blob();
            const file = new File([fileBlob], "remote_scope.zip", { type: "application/zip" });

            // 2. Importer le ZIP dans Dexie
            console.log("[useFetchScopeConfiguration] importing ZIP, size:", file.size);

            await loadKrtoZip(file, { loadDataToScopeId: scope.id });

            // 3. Marquer la version comme synchronisée
            dispatch(setLastSyncedRemoteConfigurationVersion(lastRemoteConfiguration.version));

            console.log("[useFetchScopeConfiguration] done, version:", lastRemoteConfiguration.version);

            return lastRemoteConfiguration;

        } catch (error) {
            console.error("[useFetchScopeConfiguration] error", error);
            throw error;
        }
    };

    return fetchConfiguration;
}
