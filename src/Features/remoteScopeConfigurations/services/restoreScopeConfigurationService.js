import clearScopeDataService from "Features/scopes/services/clearScopeDataService";
import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveRoute from "../utils/resolveRoute";

/**
 * Restaure une version distante d'un scope.
 *
 * Étapes:
 *  1. Supprime toutes les données locales du scope.
 *  2. Télécharge le ZIP de la version distante depuis l'endpoint `download`
 *     (configuré dans appConfig.features.remoteScopeConfigurations.download)
 *     en y injectant l'`id` de la configuration via {{configurationId}}.
 *     Si l'objet `version` expose un `url` directement utilisable, on l'utilise.
 *  3. Recharge le ZIP dans Dexie sur le scope courant via loadKrtoZip.
 */
export default async function restoreScopeConfigurationService({
    scopeId,
    version,
    appConfig,
    jwt,
}) {
    if (!scopeId) throw new Error("scopeId manquant");
    if (!version) throw new Error("version manquante");

    // 1. Résoudre l'URL de téléchargement
    let downloadUrl = version.url;

    if (!downloadUrl) {
        // Fallback: utiliser l'endpoint `download` de l'appConfig avec le scopeId.
        // (renvoie la dernière version — utile uniquement si version.url est absent)
        const downloadConfig = appConfig?.features?.remoteScopeConfigurations?.download;
        if (!downloadConfig) {
            throw new Error("Aucune URL de téléchargement (version.url absent et download config manquante)");
        }
        const fetchParams = downloadConfig.fetchParams;
        const urlConfig = {
            ...fetchParams.url,
            route: resolveRoute(fetchParams.url.route, { scopeId }),
        };
        downloadUrl = resolveUrl(urlConfig);
    }

    console.log("[restoreScopeConfigurationService] starting restore", {
        scopeId,
        version: version.version,
        downloadUrl,
    });

    // 2. Supprimer toutes les données du scope courant
    await clearScopeDataService(scopeId);

    // 3. Télécharger le ZIP
    const isAbsoluteUrl = /^https?:\/\//i.test(downloadUrl);
    const fileResponse = await fetch(downloadUrl, {
        method: "GET",
        headers: {
            // N'envoyer le JWT que si l'URL est relative (= passe par notre backend).
            // Pour une URL absolue (ex: presigned S3), on évite d'exposer le JWT.
            ...(jwt && !isAbsoluteUrl && { Authorization: `Bearer ${jwt}` }),
        },
    });

    if (!fileResponse.ok) {
        throw new Error(`Erreur HTTP: ${fileResponse.status} pour le fichier ${downloadUrl}`);
    }

    const fileBlob = await fileResponse.blob();
    const file = new File([fileBlob], "remote_scope.zip", { type: "application/zip" });

    console.log("[restoreScopeConfigurationService] downloaded ZIP, size:", file.size);

    // 4. Charger le ZIP dans Dexie sur le scope courant
    await loadKrtoZip(file, { loadDataToScopeId: scopeId });

    console.log("[restoreScopeConfigurationService] done");
}
