import { useDispatch, useSelector } from "react-redux";

import { setLastSyncedRemoteConfigurationVersion } from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import createKrtoZip from "Features/krtoFile/services/createKrtoZip";
import resolveRoute, { getNestedValue } from "../utils/resolveRoute";

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

    project = { ...project, type: project?.type ?? "PROJECT" }

    const debugAuth = getDebugAuthFromLocalStorage()
    userProfile = { ...userProfile, trigram: userProfile.trigram ?? debugAuth.trigram }

    // config

    const pushConfig = appConfig?.features?.remoteScopeConfigurations?.push;

    // push

    const push = async () => {
        try {
            if (!pushConfig) throw new Error("Push config manquante (remoteScopeConfigurations.push)");
            if (!scope) throw new Error("Aucun scope sélectionné");
            if (!project) throw new Error("Aucun projet sélectionné");

            const fetchParams = pushConfig.fetchParams;
            if (!fetchParams) throw new Error("fetchParams manquant dans la config push");

            // 1. Créer le fichier ZIP
            const file = await createKrtoZip(scope.id);

            // 2. Résoudre l'URL (avec {{scopeId}} dans la route)
            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { scopeId: scope.id }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            // 3. Construire le body en FormData
            const context = { scope, project, userProfile, file };
            const bodyTemplate = fetchParams.body;
            const formData = buildFormData(bodyTemplate, context);

            // debug : log du FormData en objet lisible
            const debugBody = {};
            for (const [key, value] of formData.entries()) {
                debugBody[key] = value instanceof File
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
                throw new Error(`Erreur HTTP: ${response.status} pour l'url ${resolvedUrl}`);
            }

            const data = await response.json();
            console.log("[usePushRemoteScopeConfiguration] response", data);

            // 5. Mettre à jour la version synchronisée
            if (data?.version) {
                dispatch(setLastSyncedRemoteConfigurationVersion(data.version));
            }

            return data;

        } catch (error) {
            console.error("[usePushRemoteScopeConfiguration] error", error);
            throw error;
        }
    };

    return push;
}

// --- Helpers ---

/**
 * Construit un FormData à partir du template body de la config et du contexte.
 * Les valeurs {{variable}} sont résolues. Le champ File reçoit l'objet File directement.
 */
function buildFormData(bodyTemplate, context) {
    const formData = new FormData();

    if (!bodyTemplate) return formData;

    for (const [key, valueTemplate] of Object.entries(bodyTemplate)) {
        const resolvedValue = resolveValue(valueTemplate, context);
        if (resolvedValue !== undefined && resolvedValue !== null) {
            formData.append(key, resolvedValue);
        }
    }

    return formData;
}

/**
 * Résout une valeur template.
 * - "{{file}}" → retourne l'objet File directement (pour FormData)
 * - "{{file.size}}" → retourne la taille du fichier
 * - "{{scope.name}}" → retourne la valeur dans le contexte
 * - valeur non-template → retourne telle quelle
 */
function resolveValue(template, context) {
    if (typeof template !== "string") return template;

    const match = template.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);
    if (match) {
        return getNestedValue(context, match[1]);
    }

    // Pas de template, on retourne la valeur brute
    return template;
}
