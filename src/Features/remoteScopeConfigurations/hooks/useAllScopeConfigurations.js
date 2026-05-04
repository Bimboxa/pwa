import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "../utils/resolveRoute";

export default function useAllScopeConfigurations() {

    // data

    const appConfig = useAppConfig();
    const jwt = useSelector((s) => s.auth.jwt);

    // config

    const allVersionsConfig = appConfig?.features?.remoteScopeConfigurations?.allVersions;
    const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

    // getAllVersions

    const getAllVersions = async ({ scopeId } = {}) => {
        try {
            if (!allVersionsConfig) throw new Error("Config manquante (remoteScopeConfigurations.allVersions)");
            if (!scopeId) throw new Error("scopeId manquant");

            const fetchParams = allVersionsConfig.fetchParams;
            if (!fetchParams) throw new Error("fetchParams manquant dans la config allVersions");

            // 1. Résoudre l'URL (avec {{scopeId}} dans la route)
            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { scopeId }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            // 2. Requête GET
            console.log("[useAllScopeConfigurations] fetching", resolvedUrl);

            const response = await fetch(resolvedUrl, {
                method: fetchParams.method || "GET",
                headers: {
                    ...(jwt && { Authorization: `Bearer ${jwt}` }),
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const bodyPreview = (await response.text()).slice(0, 200);
                throw new Error(
                    `Erreur HTTP ${response.status} (${response.statusText || "?"}) — ${resolvedUrl}\n${bodyPreview}`
                );
            }

            // Vérifier que la réponse est bien du JSON avant de parser
            const contentType = response.headers.get("content-type") || "";
            const rawBody = await response.text();

            if (!contentType.includes("application/json")) {
                const preview = rawBody.slice(0, 200);
                throw new Error(
                    `Réponse non-JSON (content-type: ${contentType || "inconnu"}) depuis ${resolvedUrl}.\nLe serveur a probablement renvoyé une page HTML (erreur d'authentification ou route inconnue).\nAperçu: ${preview}`
                );
            }

            let data;
            try {
                data = JSON.parse(rawBody);
            } catch (parseError) {
                throw new Error(
                    `Réponse JSON invalide depuis ${resolvedUrl}: ${parseError.message}`
                );
            }
            console.log("[useAllScopeConfigurations] results", data);

            // 3. Transformer les résultats avec le mapping
            const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
            const configurations = mapping
                ? items.map((item) => transformObject(item, mapping))
                : items;

            return configurations;

        } catch (error) {
            console.error("[useAllScopeConfigurations] error", error);
            throw error;
        }
    };

    return getAllVersions;
}
