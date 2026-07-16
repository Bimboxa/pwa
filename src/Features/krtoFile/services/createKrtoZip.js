import db from "App/db/db";
import sanitizeName from "Features/misc/utils/sanitizeName";
import parseDexieExportBlob from "Features/krtoFile/utils/parseDexieExportBlob";
import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
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
        if (!listing.scopeId) return true; // shared listings — scopeId absent, undefined ou null
        // BaseMaps are shared across every scope of a project: always include
        // their listings (and thus their baseMaps / versions / image files),
        // even when the listing is still bound to another scope's id — e.g. the
        // scope it was created in, or the source of a duplicated scope. Without
        // this, exporting a duplicated scope would drop all base-map images.
        if (listing.entityModel?.type === "BASE_MAP") return true;
        return false;
    });

    const listingIds = new Set(relevantListings.map((l) => l.id));
    const listingKeys = new Set(relevantListings.map((l) => l.key).filter(Boolean));

    // Tables avec scopeId direct
    const tablesWithScopeId = new Set([
        "baseMapViews", "syncFiles", "layers",
        "portfolioBaseMapContainers", "meshes3d", "povs",
    ]);

    // Tables avec listingId (sans projectId)
    const tablesWithListingIdOnly = new Set([
        "zonings", "legends", "markers", "relationsEntities", "reports",
    ]);

    // Tables avec listingKey (entitiesProps)
    const tablesWithListingKey = new Set(["entitiesProps"]);

    // Tables avec projectId + listingId
    // portfolioPages: créées via useCreateEntity, qui pose projectId+listingId
    // mais pas scopeId — donc on filtre par projectId+listingId comme entities/maps.
    // On garde baseMapVersions ici (y compris les versions supprimées : ce ne sont
    // que des métadonnées légères). Seuls les fichiers (lourds) sont traités à part.
    const tablesWithProjectIdAndListingId = new Set([
        "baseMaps", "baseMapVersions", "entities", "maps", "materials", "relsZoneEntity",
        "annotations", "annotationTemplates",
        "portfolioPages",
    ]);

    // Points: annotation geometry lives in db.points, but a point row's
    // listingId is NOT reliable (paste/clone paths historically omitted it,
    // and it may diverge from the annotation's listing). The snapshot contract
    // is: every point referenced by an exported annotation must be in the ZIP.
    // So the points table is filtered on the referenced-id set collected from
    // the exported annotations (live + tombstones — the ZIP is a full
    // snapshot), via the same collectReferencedPointIds the read/purge paths
    // use. Unreferenced (orphan) points are intentionally dropped.
    const exportedAnnotations = (
        await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter((a) => listingIds.has(a.listingId));
    const referencedPointIds = collectReferencedPointIds(exportedAnnotations);

    // 2bis. Versions de baseMap supprimées (soft-delete) : on conserve la version
    // dans le JSON, mais on exclut son image du zip pour éviter de l'alourdir avec
    // des fichiers orphelins.
    const versions = (
        await db.baseMapVersions.where("projectId").equals(projectId).toArray()
    ).filter((v) => listingIds.has(v.listingId));

    const liveVersionFileNames = new Set();
    const deletedVersionFileNames = new Set();
    for (const v of versions) {
        const fn = v.image?.fileName;
        if (!fn) continue;
        (v.deletedAt ? deletedVersionFileNames : liveVersionFileNames).add(fn);
    }
    // Un fichier encore référencé par une version vivante ne doit JAMAIS être exclu
    // (cas où plusieurs versions partagent la même image, ex. duplication).
    for (const fn of liveVersionFileNames) deletedVersionFileNames.delete(fn);

    // 2ter. Vignettes des POV : leurs fichiers n'ont pas de listingId (le POV
    // n'appartient à aucun listing), donc le filtre files standard les
    // exclurait. On les whiteliste explicitement (POV vivants uniquement).
    const scopePovs = (
        await db.povs.where("scopeId").equals(scopeId).toArray()
    ).filter((p) => !p.deletedAt);
    const povImageFileNames = new Set(
        scopePovs.map((p) => p.image?.fileName).filter(Boolean)
    );

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

            // Tables avec projectId uniquement
            if (table === "entityModels" || table === "relAnnotationMappingCategory") {
                return value.projectId === projectId;
            }

            // Tables indexées par scopeId
            if (tablesWithScopeId.has(table)) return value.scopeId === scopeId;

            // Points : filtrés par référence (voir referencedPointIds ci-dessus),
            // jamais par listingId.
            if (table === "points") return referencedPointIds.has(value.id);

            // Fichiers : on exclut les images des versions supprimées orphelines
            if (table === "files") {
                if (povImageFileNames.has(value.fileName)) {
                    return value.projectId === projectId;
                }
                return (
                    value.projectId === projectId &&
                    listingIds.has(value.listingId) &&
                    !deletedVersionFileNames.has(value.fileName)
                );
            }

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

            // Tables ignorées (orgaData, projectFiles, baseMapTransforms, portfolios [deleted v14])
            return false;
        },
    });

    // 4. Traitement
    const jsonData = await parseDexieExportBlob(blob);
    const zip = new JSZip();

    // Self-consistency: a point referenced by a LIVE annotation must be live in
    // the snapshot. The local DB can hold referenced-but-tombstoned points
    // (annotation deleted → points soft-deleted → annotation restored without
    // its rows); exporting the tombstone would keep the restored scope broken.
    const liveReferencedPointIds = collectReferencedPointIds(
        exportedAnnotations.filter((a) => !a.deletedAt)
    );
    const pointsTableData = jsonData.data.data.find((t) => t.tableName === "points");
    if (pointsTableData?.rows) {
        for (const row of pointsTableData.rows) {
            if (row?.deletedAt && liveReferencedPointIds.has(row.id)) {
                delete row.deletedAt;
                delete row.deletedByUserIdMaster;
            }
        }
    }

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
