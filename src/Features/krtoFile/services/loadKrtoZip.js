import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";
import JSZip from "jszip";

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

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

        // 3. Réhydrater les images dans le JSON (en Base64 temporaire)
        const filesTableData = jsonData.data.data.find((t) => t.tableName === "files");

        if (filesTableData && filesTableData.rows) {
            const promises = filesTableData.rows.map(async (row) => {
                if (row.fileName && !row.fileArrayBuffer) {
                    const zipImage = zip.file(`images/${row.fileName}`);
                    if (zipImage) {
                        const base64Content = await zipImage.async("base64");
                        row.fileArrayBuffer = base64Content;
                    }
                }
            });
            await Promise.all(promises);
        }

        // Récupérer l'ID du scope original depuis le JSON pour le remapping
        const scopesTableData = jsonData.data.data.find((t) => t.tableName === "scopes");
        const originalScopeId = scopesTableData?.rows?.[0]?.id;

        // 4. Créer le Blob JSON pour Dexie
        const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: "application/json" });

        // 5. Import avec conversion forcée en ArrayBuffer
        await db.import(jsonBlob, {
            overwriteValues: true,
            acceptVersionDiff: true,
            acceptMissingTables: true,
            chunkSizeBytes: 15 * 1024 * 1024,
            noTransaction: false,

            transform: (table, value) => {
                // 1. Conversion Base64 -> ArrayBuffer pour les files
                if (table === "files" && value.fileArrayBuffer && typeof value.fileArrayBuffer === "string") {
                    value.fileArrayBuffer = base64ToArrayBuffer(value.fileArrayBuffer);
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

    return { project, scope };
}
