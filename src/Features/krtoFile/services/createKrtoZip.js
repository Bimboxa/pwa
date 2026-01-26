import db from "App/db/db";
import sanitizeName from "Features/misc/utils/sanitizeName";
import JSZip from "jszip";

export default async function createKrtoZip(projectId, options) {
    const nameFileWithTimestamp = options?.nameFileWithTimestamp;
    const getAnnotationTemplatesFromListingId = options?.getAnnotationTemplatesFromListingId;

    // On rejette le cas d'export partiel de template pour simplifier
    if (getAnnotationTemplatesFromListingId) {
        throw new Error("createKrtoZip n'est pas supporté pour l'export partiel de templates.");
    }

    // 1. Récupération du projet pour le nommage
    const project = await db.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    // 2. Export via Dexie (Cela génère un JSON où les ArrayBuffers sont encodés en Base64)
    const blob = await db.export({
        filter: (table, value) => {
            if (table === "projects") return value.id === projectId;
            return "projectId" in (value ?? {}) && value.projectId === projectId;
        },
    });

    // 3. Traitement
    const jsonText = await blob.text();
    const jsonData = JSON.parse(jsonText);
    const zip = new JSZip();

    // On repère la table 'files'
    const filesTableData = jsonData.data.data.find((t) => t.tableName === "files");

    if (filesTableData && filesTableData.rows) {
        const imgFolder = zip.folder("images");

        filesTableData.rows.forEach((row) => {
            // row.fileArrayBuffer est ici une String Base64 (format d'export Dexie standard)
            // row.fileName est le nom (ex: "image.png")

            if (row.fileArrayBuffer && row.fileName) {
                // { base64: true } indique à JSZip de décoder la string pour créer un VRAI fichier binaire dans le zip
                imgFolder.file(row.fileName, row.fileArrayBuffer, { base64: true });

                // On supprime la donnée du JSON pour qu'il soit léger
                delete row.fileArrayBuffer;
            }
        });
    }

    // 4. Ajout du JSON nettoyé
    zip.file("project_data.json", JSON.stringify(jsonData));

    // 5. Génération du nom
    const sanitizedName = sanitizeName(project.name || "project");
    const timestamp = Date.now();
    const filename = nameFileWithTimestamp
        ? `${sanitizedName}_${timestamp}.zip`
        : `${sanitizedName}.zip`;

    // 6. Génération du Blob ZIP final
    const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    return new File([zipBlob], filename, { type: "application/zip" });
}