import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "../utils/resolveRoute";

export default function useScopeConfigurationsByProject() {

    // data

    const appConfig = useAppConfig();
    const jwt = useSelector((s) => s.auth.jwt);

    // config

    const getByProjectConfig = appConfig?.features?.remoteScopeConfigurations?.getByProject;
    const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

    // getByProject

    const getByProject = async ({ project } = {}) => {
        try {
            if (!getByProjectConfig) throw new Error("Config manquante (remoteScopeConfigurations.getByProject)");
            if (!project?.idMaster) throw new Error("project.idMaster manquant");

            const fetchParams = getByProjectConfig.fetchParams;
            if (!fetchParams) throw new Error("fetchParams manquant dans la config getByProject");

            // 1. Résoudre l'URL (avec {{project.idMaster}} dans la route)
            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { project }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            // 2. Requête GET
            console.log("[useScopeConfigurationsByProject] fetching", resolvedUrl);

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
            console.log("[useScopeConfigurationsByProject] results", data);

            // 3. Transformer les résultats avec le mapping
            const items = Array.isArray(data) ? data : (data?.items ?? data?.results ?? []);
            const configurations = mapping
                ? items.map((item) => transformObject(item, mapping))
                : items;

            return configurations;

        } catch (error) {
            console.error("[useScopeConfigurationsByProject] error", error);
            throw error;
        }
    };

    return getByProject;
}
