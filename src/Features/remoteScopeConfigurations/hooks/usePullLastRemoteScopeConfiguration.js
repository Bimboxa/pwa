import { useDispatch, useSelector } from "react-redux";

import { setLastRemoteConfiguration } from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "../utils/resolveRoute";

export default function usePullLastRemoteScopeConfiguration() {
    const dispatch = useDispatch();

    // data

    const appConfig = useAppConfig();
    const jwt = useSelector((s) => s.auth.jwt);
    const { value: scope } = useSelectedScope();

    // config

    const pullConfig = appConfig?.features?.remoteScopeConfigurations?.pull;
    const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

    // pull — récupère uniquement les métadonnées de la config distante

    const pull = async () => {
        try {
            if (!pullConfig) throw new Error("Pull config manquante (remoteScopeConfigurations.pull)");
            if (!scope) throw new Error("Aucun scope sélectionné");

            const fetchParams = pullConfig.fetchParams;
            if (!fetchParams) throw new Error("fetchParams manquant dans la config pull");

            // 1. Résoudre l'URL (avec {{scopeId}} dans la route)
            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { scopeId: scope.id }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            // 2. Requête GET pour récupérer les métadonnées
            console.log("[usePullLastRemoteScopeConfiguration] fetching", resolvedUrl);

            const response = await fetch(resolvedUrl, {
                method: fetchParams.method || "GET",
                headers: {
                    ...(jwt && { Authorization: `Bearer ${jwt}` }),
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status} pour l'url ${resolvedUrl}`);
            }

            const data = await response.json();
            console.log("[usePullLastRemoteScopeConfiguration] metadata", data);

            // 3. Transformer la réponse avec le mapping
            const configuration = mapping ? transformObject(data, mapping) : data;

            // 4. Mettre à jour le store avec les métadonnées distantes
            dispatch(setLastRemoteConfiguration(configuration));

            console.log("[usePullLastRemoteScopeConfiguration] done, version:", configuration.version);

            return configuration;

        } catch (error) {
            console.error("[usePullLastRemoteScopeConfiguration] error", error);
            throw error;
        }
    };

    return pull;
}
