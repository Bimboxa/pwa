import db from "App/db/db";
import sanitizeName from "Features/misc/utils/sanitizeName";
import JSZip from "jszip";

export default async function createKrtoZip(scopeId, options) {
    const nameFileWithTimestamp = options?.nameFileWithTimestamp;

    // 1. Récupération du scope et du projet
    const scope = await db.scopes.get(scopeId);
    if (!scope) throw new Error(`Scope ${scopeId} not found`);

    const projectId = scope.projectId;
    const project = await db.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    // 2. Récupération des listings liés au scope
    // - Listings avec scopeId === scopeId (scoped: LOCATED_ENTITY, BLUEPRINT)
    // - Listings du projet sans scopeId (shared: BASE_MAP, etc.)
    const allProjectListings = await db.listings
        .where("projectId")
        .equals(projectId)
        .toArray();

    const relevantListings = allProjectListings.filter((listing) => {
        if (listing.scopeId === scopeId) return true;
        if (!listing.scopeId) return true; // shared listings (baseMaps, etc.) — scopeId absent, undefined ou null
        return false;
    });

    const listingIds = new Set(relevantListings.map((l) => l.id));
    const listingKeys = new Set(relevantListings.map((l) => l.key).filter(Boolean));

    // Tables avec scopeId direct
    const tablesWithScopeId = new Set(["baseMapViews", "syncFiles"]);

    // Tables avec listingId (sans projectId)
    const tablesWithListingIdOnly = new Set([
        "zonings", "legends", "markers", "relationsEntities", "reports",
    ]);

    // Tables avec listingKey (entitiesProps)
    const tablesWithListingKey = new Set(["entitiesProps"]);

    // Tables avec projectId + listingId
    const tablesWithProjectIdAndListingId = new Set([
        "baseMaps", "entities", "maps", "materials", "relsZoneEntity",
        "points", "annotations", "annotationTemplates", "files",
    ]);

    // 3. Export via Dexie
    const blob = await db.export({
        filter: (table, value) => {
            if (!value) return false;

            // Le projet
            if (table === "projects") return value.id === projectId;

            // Le scope
            if (table === "scopes") return value.id === scopeId;

            // Listings filtrés
            if (table === "listings") return listingIds.has(value.id);

            // Blueprints (ont scopeId directement)
            if (table === "blueprints") return value.scopeId === scopeId;

            // Tables indexées par scopeId
            if (tablesWithScopeId.has(table)) return value.scopeId === scopeId;

            // Tables avec projectId + listingId
            if (tablesWithProjectIdAndListingId.has(table)) {
                return value.projectId === projectId && listingIds.has(value.listingId);
            }

            // Tables avec listingId uniquement
            if (tablesWithListingIdOnly.has(table)) {
                return listingIds.has(value.listingId);
            }

            // entitiesProps (utilise listingKey)
            if (tablesWithListingKey.has(table)) {
                return listingKeys.has(value.listingKey);
            }

            // Tables ignorées (orgaData, projectFiles, baseMapTransforms)
            return false;
        },
    });

    // 4. Traitement
    const jsonText = await blob.text();
    const jsonData = JSON.parse(jsonText);
    const zip = new JSZip();

    // On repère la table 'files'
    const filesTableData = jsonData.data.data.find((t) => t.tableName === "files");

    if (filesTableData && filesTableData.rows) {
        const imgFolder = zip.folder("images");

        filesTableData.rows.forEach((row) => {
            if (row.fileArrayBuffer && row.fileName) {
                imgFolder.file(row.fileName, row.fileArrayBuffer, { base64: true });
                delete row.fileArrayBuffer;
            }
        });
    }

    // 5. Ajout du JSON nettoyé
    zip.file("project_data.json", JSON.stringify(jsonData));

    // 6. Génération du nom (scope name + project name)
    const scopeName = sanitizeName(scope.name || "scope");
    const projectName = sanitizeName(project.name || "project");
    const timestamp = Date.now();
    const baseName = `${projectName}_${scopeName}`;
    const filename = nameFileWithTimestamp
        ? `${baseName}_${timestamp}.zip`
        : `${baseName}.zip`;

    // 7. Génération du Blob ZIP final
    const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    return new File([zipBlob], filename, { type: "application/zip" });
}
