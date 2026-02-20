import { useDispatch, useSelector } from "react-redux";

import { setLastSyncedRemoteConfigurationVersion } from "../remoteScopeConfigurationsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";

export default function useFetchScopeConfiguration() {
    const dispatch = useDispatch();

    // data

    const jwt = useSelector((s) => s.auth.jwt);
    const lastRemoteConfiguration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);
    const { value: scope } = useSelectedScope();

    // fetch — télécharge le ZIP et l'importe dans Dexie

    const fetchConfiguration = async () => {
        try {
            if (!scope) throw new Error("Aucun scope sélectionné");
            if (!lastRemoteConfiguration?.url) {
                throw new Error("URL du fichier manquante dans la configuration distante");
            }

            // 1. Télécharger le fichier ZIP
            console.log("[useFetchScopeConfiguration] downloading file", lastRemoteConfiguration.url);

            const fileResponse = await fetch(lastRemoteConfiguration.url, {
                headers: {
                    ...(jwt && { Authorization: `Bearer ${jwt}` }),
                },
            });

            if (!fileResponse.ok) {
                throw new Error(`Erreur HTTP: ${fileResponse.status} pour le fichier ${lastRemoteConfiguration.url}`);
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
