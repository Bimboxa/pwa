import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import { slugify } from "Features/promptIa/services/buildPromptIaZip";
import { readPdfPageFrames } from "Features/promptIa/services/readPdfPageFrame";

import instructionsBody from "../docs/PROMPT_IA_PROJECT_INSTRUCTIONS.md?raw";
import buildPromptIaProjectContext from "../utils/buildPromptIaProjectContext";

export const DATA_DIR = "donnees";

// Already compressed formats are stored as is.
const STORED_EXTENSIONS = /\.(pdf|png|jpe?g|webp|zip|xlsx|docx|pptx)$/i;

const isPdf = (entry) =>
  entry.file?.type === "application/pdf" || /\.pdf$/i.test(entry.path);

// `contexte.json` builder — pure util, kept exported here for the callers.
export const buildProjectContext = buildPromptIaProjectContext;

export function buildProjectInstructionsMarkdown(context) {
  const title = context.project.name ?? "nouveau projet";
  const files = context.files.map(
    (f) => `- \`${f.path}\`${f.pageCount ? ` — ${f.pageCount} page(s)` : ""}`
  );
  const lines = [
    `# Création d'un projet — ${title}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le zip demandé dans",
    "> la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Projet** : ${title}${
      context.project.clientRef ? ` (n° ${context.project.clientRef})` : ""
    }`,
    "",
    "**Scopes à créer**",
    "",
    context.scopesDescription,
    "",
    "**Fichiers**",
    "",
    "- `contexte.json` — données de la demande (à lire en premier)",
    ...(files.length ? files : ["- (aucune donnée d'entrée)"]),
    "",
    "---",
    "",
    instructionsBody.trim(),
    "",
  ];
  return lines.join("\n");
}

/**
 * Describes the input entries for `contexte.json` (`donnees/<path>`, mime,
 * size, and for each PDF the size / rotation of its pages).
 *
 * @param {Array<{path: string, file: File}>} entries
 * @returns {Promise<{files: Array, unreadablePdfs: string[]}>}
 */
export async function describePromptIaEntries(entries = []) {
  const unreadablePdfs = [];
  const files = [];
  for (const entry of entries) {
    const path = `${DATA_DIR}/${entry.path}`;
    const described = {
      path,
      mime: entry.file.type || null,
      byteSize: entry.file.size ?? null,
    };
    if (isPdf(entry)) {
      try {
        const frames = await readPdfPageFrames(entry.file);
        described.pageCount = frames.pageCount;
        described.pages = frames.pages;
      } catch (e) {
        // The file still goes in the zip: the model may read it its own way.
        console.warn("[promptIaProject] unreadable pdf", entry.path, e);
        unreadablePdfs.push(entry.path);
      }
    }
    files.push(described);
  }
  return { files, unreadablePdfs };
}

/**
 * Zips INSTRUCTIONS.md, contexte.json and the input files under `donnees/`
 * (already compressed formats stored as is).
 *
 * @returns {Promise<Blob>}
 */
export async function generatePromptIaZip({ instructions, context, entries }) {
  const zip = new JSZip();
  zip.file("INSTRUCTIONS.md", instructions);
  zip.file("contexte.json", JSON.stringify(context, null, 2));
  for (const entry of entries) {
    zip.file(
      `${DATA_DIR}/${entry.path}`,
      entry.file,
      STORED_EXTENSIONS.test(entry.path) ? { compression: "STORE" } : undefined
    );
  }
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true,
  });
}

/**
 * Builds and downloads `prompt-ia-projet-<name>.zip`: INSTRUCTIONS.md,
 * contexte.json and the input files under `donnees/`.
 *
 * @param {Object} params
 * @param {{name?: string, clientRef?: string}} params.project
 * @param {string} params.description - scopes to create, in the user's words
 * @param {Array<{path: string, file: File}>} params.entries
 * @returns {Promise<{fileName: string, sizeBytes: number, unreadablePdfs: string[], blob: Blob}>}
 */
export default async function buildPromptIaProjectZip({
  project,
  description,
  entries = [],
  download = true,
}) {
  const { files, unreadablePdfs } = await describePromptIaEntries(entries);
  const context = buildProjectContext({ project, description, files });
  const blob = await generatePromptIaZip({
    instructions: buildProjectInstructionsMarkdown(context),
    context,
    entries,
  });
  const fileName = `prompt-ia-projet-${slugify(
    project?.name || project?.clientRef || "projet"
  )}.zip`;
  if (download) downloadBlob(blob, fileName);

  return { fileName, sizeBytes: blob.size, unreadablePdfs, blob };
}
