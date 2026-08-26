import db from "App/db/db";

import clearScopeDataService from "Features/scopes/services/clearScopeDataService";
import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveRoute from "../utils/resolveRoute";

/**
 * Restaure une version distante d'un scope.
 *
 * Étapes:
 *  1. Supprime toutes les données locales du scope.
 *  2. Télécharge le ZIP de la *version sélectionnée* depuis l'endpoint
 *     `downloadByConfigId`
 *     (configuré dans appConfig.features.remoteScopeConfigurations.downloadByConfigId)
 *     en y injectant l'`idMaster` de la configuration via {{idMaster}}.
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

    // 1. Résoudre l'URL de téléchargement de la version sélectionnée
    let downloadUrl = version.url;

    if (!downloadUrl) {
        // Télécharger la configuration ciblée par son idMaster (id de la version),
        // et non la dernière version du scope.
        const downloadByConfigIdConfig =
            appConfig?.features?.remoteScopeConfigurations?.downloadByConfigId;
        if (!downloadByConfigIdConfig) {
            throw new Error("Aucune URL de téléchargement (version.url absent et downloadByConfigId config manquante)");
        }
        if (!version.idMaster) {
            throw new Error("version.idMaster manquant — impossible de télécharger la version ciblée");
        }
        const fetchParams = downloadByConfigIdConfig.fetchParams;
        const urlConfig = {
            ...fetchParams.url,
            route: resolveRoute(fetchParams.url.route, { idMaster: version.idMaster }),
        };
        downloadUrl = resolveUrl(urlConfig);
    }

    console.log("[restoreScopeConfigurationService] starting restore", {
        scopeId,
        version: version.version,
        downloadUrl,
    });

    // TODO (robustness, not yet implemented): wrap the clear (step 2) + import
    // (step 4) in a single atomic Dexie transaction so a failed download/import
    // cannot leave the scope half-cleared / partially restored. Currently they
    // run as separate steps. Out of scope for the batch/hook fix.

    // Le projet local avant restauration : restaurer une ancienne version du
    // scope ne doit pas rétrograder les métadonnées du projet (nom / numéro),
    // que le zip de la version embarque telles qu'au moment du push.
    const localScope = await db.scopes.get(scopeId);
    const localProject = localScope?.projectId
        ? await db.projects.get(localScope.projectId)
        : null;

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
    await loadKrtoZip(file, {
        loadDataToScopeId: scopeId,
        ...(localProject && {
            loadDataToProjectId: localProject.id,
            projectOverrides: {
                name: localProject.name,
                clientRef: localProject.clientRef,
                type: localProject.type,
            },
        }),
    });

    console.log("[restoreScopeConfigurationService] done");
}
