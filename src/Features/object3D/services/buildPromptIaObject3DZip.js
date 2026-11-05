import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import {
  slugify,
  attachmentEntryName,
} from "Features/promptIa/services/buildPromptIaZip";
import { isCompressibleAttachment } from "Features/promptIa/utils/promptIaAttachmentTypes";

import instructionsBody from "../docs/PROMPT_IA_OBJECT_3D_INSTRUCTIONS.md?raw";

const ATTACHMENTS_DIR = "pieces-jointes";
const DEFAULT_SLUG = "objet";

// Binary 3D references are already compact; text ones (obj, gltf…) deflate
// well.
const STORED_3D_REGEX = /\.glb$/i;

function getSlug(name) {
  return name ? slugify(name) : DEFAULT_SLUG;
}

export function buildObject3DInstructionsMarkdown({ context }) {
  const files = [
    "- `contexte.json` — données de la demande (à lire en premier)",
    ...context.attachments.map((a) => `- \`${a.file}\` — pièce jointe`),
  ];
  const lines = [
    `# Objet 3D — ${context.object.name ?? "nouvel objet"}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le fichier `.glb`",
    "> demandé dans la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Objet à modéliser** : ${context.object.name ?? "(sans nom — voir la description)"}.`,
    "",
    ...(context.object.description
      ? ["**Description de l'utilisateur**", "", context.object.description, ""]
      : [
          "**Description de l'utilisateur** : aucune — appuie-toi sur le nom de l'objet et les pièces jointes.",
          "",
        ]),
    `**Fichier attendu** : \`${context.output.fileName}\``,
    "",
    "**Fichiers**",
    "",
    ...files,
    "",
    "---",
    "",
    instructionsBody.trim(),
    "",
  ];
  return lines.join("\n");
}

/**
 * Builds and downloads `prompt-ia-objet-3d-<name>.zip`: INSTRUCTIONS.md,
 * contexte.json and the dropped files under `pieces-jointes/`. An external AI
 * chat turns it into a `.glb`, which the user then drops in the « Objet 3D »
 * field. The files stay in memory: nothing is stored in the project.
 *
 * @param {{name?: string, description?: string, files?: File[],
 *   download?: boolean}} params
 * @returns {Promise<{fileName: string, files: string[], sizeBytes: number,
 *   blob: Blob}>}
 */
export default async function buildPromptIaObject3DZip({
  name,
  description,
  files = [],
  download = true,
}) {
  const zip = new JSZip();
  const taken = new Set();
  const entries = [];
  const attachments = [];

  for (const file of files) {
    const entry = `${ATTACHMENTS_DIR}/${attachmentEntryName(file.name, taken)}`;
    const compress =
      isCompressibleAttachment(file.name) && !STORED_3D_REGEX.test(file.name);
    zip.file(entry, file, { compression: compress ? "DEFLATE" : "STORE" });
    entries.push(entry);
    attachments.push({
      name: file.name,
      file: entry,
      mime: file.type || null,
      byteSize: file.size ?? null,
    });
  }

  const objectName = name?.trim() || null;
  const slug = getSlug(objectName);
  const context = {
    version: "1.0",
    object: {
      name: objectName,
      description: description?.trim() || null,
    },
    attachments,
    conventions: {
      unit: "meter",
      upAxis: "+Y",
      footprint: "X × Z",
      front: "+Z",
      origin: "base at Y = 0, bounding box centered on X = 0 and Z = 0",
      targetTriangles: 50000,
      maxTriangles: 200000,
    },
    output: {
      format: "glb",
      fileName: `${slug}.glb`,
      forbiddenExtensions: [
        "KHR_draco_mesh_compression",
        "EXT_meshopt_compression",
        "KHR_texture_basisu",
      ],
    },
  };

  zip.file("INSTRUCTIONS.md", buildObject3DInstructionsMarkdown({ context }));
  zip.file("contexte.json", JSON.stringify(context, null, 2));

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const fileName = `prompt-ia-objet-3d-${slug}.zip`;
  if (download) downloadBlob(blob, fileName);

  return {
    fileName,
    files: ["INSTRUCTIONS.md", "contexte.json", ...entries],
    sizeBytes: blob.size,
    blob,
  };
}
