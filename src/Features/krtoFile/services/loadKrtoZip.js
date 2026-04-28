import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";
import JSZip from "jszip";

export default async function loadKrtoZip(file, options) {
    if (!file) throw new Error("Fichier invalide");

    console.log("Loading KRTO ZIP, size:", file.size);

    const importTag = nanoid();
    const loadDataToProjectId = options?.loadDataToProjectId;
    const loadDataToScopeId = options?.loadDataToScopeId;

    try {
        // 1. Ouvrir le ZIP
        const zip = await JSZip.loadAsync(file);

        // 2. Lire le JSON principal
        const jsonFile = Object.values(zip.files).find(f => f.name.endsWith(".json"));
        if (!jsonFile) throw new Error("JSON introuvable dans le ZIP");

        const jsonContent = await jsonFile.async("text");
        const jsonData = JSON.parse(jsonContent);

        // Keep binaries out of the JSON: dexie-export-import's SAX parser caps textNode at 10 MB.
        const imageEntries = Object.values(zip.files).filter(
            (f) => !f.dir && f.name.startsWith("images/")
        );
        const imageBuffers = new Map();
        await Promise.all(
            imageEntries.map(async (entry) => {
                const fileName = entry.name.slice("images/".length);
                const arrayBuffer = await entry.async("arraybuffer");
                imageBuffers.set(fileName, arrayBuffer);
            })
        );

        // Récupérer l'ID du scope original depuis le JSON pour le remapping
        const scopesTableData = jsonData.data.data.find((t) => t.tableName === "scopes");
        const originalScopeId = scopesTableData?.rows?.[0]?.id;

        // 4. Créer le Blob JSON pour Dexie
        const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: "application/json" });

        // 5. Import avec injection des ArrayBuffer via transform
        await db.import(jsonBlob, {
            overwriteValues: true,
            acceptVersionDiff: true,
            acceptMissingTables: true,
            chunkSizeBytes: 15 * 1024 * 1024,
            noTransaction: false,

            transform: (table, value) => {
                // 1. Injection des ArrayBuffer pour les files (depuis le ZIP)
                if (table === "files" && value.fileName) {
                    const arrayBuffer = imageBuffers.get(value.fileName);
                    if (arrayBuffer) {
                        value.fileArrayBuffer = arrayBuffer;
                    }
                }

                // 2. Remapping projectId
                if (loadDataToProjectId) {
                    if (table === "projects") {
                        value = { ...value, id: loadDataToProjectId };
                    } else if ("projectId" in value) {
                        value = { ...value, projectId: loadDataToProjectId };
                    }
                }

                // 3. Remapping scopeId
                if (loadDataToScopeId && originalScopeId) {
                    if (table === "scopes" && value.id === originalScopeId) {
                        value = { ...value, id: loadDataToScopeId };
                    } else if ("scopeId" in value && value.scopeId === originalScopeId) {
                        value = { ...value, scopeId: loadDataToScopeId };
                    }
                }

                // 4. Tag le projet pour le retrouver après import
                if (table === "projects") {
                    value = { ...value, __importTag: importTag };
                }

                return { value };
            },
            progressCallback: (progress) => {
                console.log(`Import: ${Math.round((progress.completedRows / progress.totalRows) * 100)}%`);
                return true;
            },
        });

    } catch (error) {
        console.error("Erreur import KRTO ZIP:", error);
        throw new Error(`Import failed: ${error.message}`);
    }

    // 6. Nettoyage du tag et retour du projet + scope
    const project = await db.projects.where("__importTag").equals(importTag).first();
    if (project) {
        await db.projects.update(project.id, { __importTag: undefined });
    }

    // Retrouver le scope importé (1 seul scope par krto)
    const scope = project
        ? await db.scopes.where("projectId").equals(project.id).first()
        : null;

    // --- DEBUG: vérifier ce qui a été importé pour le scope ---
    if (scope) {
        const allListings = await db.listings.where("scopeId").equals(scope.id).toArray();
        const liveListings = allListings.filter((l) => !l.deletedAt);
        const portfolioListings = liveListings.filter(
            (l) => l?.entityModel?.type === "PORTFOLIO_PAGE"
        );
        const allPages = await db.portfolioPages.where("scopeId").equals(scope.id).toArray();
        const livePages = allPages.filter((p) => !p.deletedAt);
        const allContainers = await db.portfolioBaseMapContainers
            .where("scopeId").equals(scope.id).toArray();
        const liveContainers = allContainers.filter((c) => !c.deletedAt);

        console.log("[loadKrtoZip][DEBUG] import done", {
            projectId: project?.id,
            scopeId: scope.id,
            scopeName: scope.name,
            listings: {
                total: allListings.length,
                live: liveListings.length,
                portfolioPageType: portfolioListings.length,
                portfolioListings: portfolioListings.map((l) => ({
                    id: l.id,
                    name: l.name,
                    entityModelKey: l.entityModelKey,
                    entityModelType: l?.entityModel?.type,
                    deletedAt: l.deletedAt,
                })),
            },
            portfolioPages: {
                total: allPages.length,
                live: livePages.length,
                byListingId: livePages.reduce((acc, p) => {
                    acc[p.listingId] = (acc[p.listingId] || 0) + 1;
                    return acc;
                }, {}),
            },
            portfolioBaseMapContainers: {
                total: allContainers.length,
                live: liveContainers.length,
                byPortfolioPageId: liveContainers.reduce((acc, c) => {
                    acc[c.portfolioPageId] = (acc[c.portfolioPageId] || 0) + 1;
                    return acc;
                }, {}),
            },
        });
    }

    return { project, scope };
}
