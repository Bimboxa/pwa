import { useDispatch, useSelector } from "react-redux";

import {
    setLastSyncedRemoteConfigurationVersion,
    setLastLocalChangeAt,
} from "../remoteScopeConfigurationsSlice";

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

    // fetch — downloads the ZIP and MERGES it into the local Dexie data:
    // local rows are kept, the remote version's novelties are added, and when
    // the same row exists on both sides the most recently modified one wins.

    const fetchConfiguration = async () => {
        try {
            if (!downloadConfig) throw new Error("Download config manquante (remoteScopeConfigurations.download)");
            if (!scope) throw new Error("Aucun scope sélectionné");
            // A falsy projectId would silently skip the project remap in
            // loadKrtoZip and land the imported data under a foreign
            // projectId (invisible scope) — abort instead.
            if (!scope.projectId) throw new Error("Scope sans projectId — récupération annulée");

            // 1. Résoudre l'URL de téléchargement (avec {{scopeId}} dans la route)
            const fetchParams = downloadConfig.fetchParams;
            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { scopeId: scope.id }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            console.log("[merge scope] downloading file", resolvedUrl);

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

            // 2. Merger le ZIP dans Dexie
            console.log("[merge scope] merging ZIP, size:", file.size);

            await loadKrtoZip(file, {
                loadDataToScopeId: scope.id,
                // Remapper les données du zip sur le projet local du scope
                // (le zip peut porter un autre id projet), et garder les
                // métadonnées projet de la scopeConfiguration comme référence
                // (le zip peut embarquer un nom / numéro périmés).
                loadDataToProjectId: scope.projectId,
                projectOverrides: {
                    name: lastRemoteConfiguration?.projectName,
                    clientRef: lastRemoteConfiguration?.projectClientRef,
                    type: lastRemoteConfiguration?.projectType,
                },
                merge: true,
                reownToImportingUser: true,
            });

            // 3. Marquer la version comme synchronisée. L'état local mergé
            // n'est plus égal à la version serveur → flag dirty explicite
            // (l'import sous withSystemWrite ne passe pas par
            // notifyLocalChange), pour inviter à sauvegarder le merge.
            dispatch(setLastSyncedRemoteConfigurationVersion(lastRemoteConfiguration.version));
            dispatch(setLastLocalChangeAt(Date.now()));

            console.log("[merge scope] done, version:", lastRemoteConfiguration.version);

            // 4. Reload: guarantees redux / liveQuery state coherent with the
            // rewritten DB (same pattern as the app-init update dialog).
            window.location.reload();

            return lastRemoteConfiguration;

        } catch (error) {
            console.error("[merge scope]", error);
            throw error;
        }
    };

    return fetchConfiguration;
}
