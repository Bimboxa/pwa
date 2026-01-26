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
    return bytes.buffer; // Renvoie bien l'ArrayBuffer sous-jacent
}

export default async function loadKrtoZip(file, options) {
    if (!file) throw new Error("Fichier invalide");

    console.log("Loading KRTO ZIP, size:", file.size);

    const importTag = nanoid();
    const loadDataToProjectId = options?.loadDataToProjectId;

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
                        // On met du Base64 car le JSON ne supporte pas le binaire
                        const base64Content = await zipImage.async("base64");
                        row.fileArrayBuffer = base64Content;
                    }
                }
            });
            await Promise.all(promises);
        }

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
                // --- C'EST ICI QUE LA MAGIE OPÈRE ---

                // 1. Si c'est la table 'files' et qu'on a du Base64, on le remet en ArrayBuffer
                if (table === "files" && value.fileArrayBuffer && typeof value.fileArrayBuffer === "string") {
                    // Conversion explicite pour être sûr d'avoir l'objet du screenshot
                    value.fileArrayBuffer = base64ToArrayBuffer(value.fileArrayBuffer);
                }

                // 2. Logique existante pour les IDs de projet
                if (loadDataToProjectId) {
                    if (table === "projects") {
                        return { value: { ...value, id: loadDataToProjectId, __importTag: importTag } };
                    }
                    if ("projectId" in value) {
                        return { value: { ...value, projectId: loadDataToProjectId } };
                    }
                    return { value };
                } else {
                    if (table === "projects" && value) {
                        return { value: { ...value, __importTag: importTag } };
                    }
                    return { value };
                }
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

    // 6. Nettoyage
    const project = await db.projects.where("__importTag").equals(importTag).first();
    if (project) {
        await db.projects.update(project.id, { __importTag: undefined });
    }

    return project;
}