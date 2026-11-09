import downloadBlob from "Features/files/utils/downloadBlob";
import { slugify } from "Features/promptIa/services/buildPromptIaZip";

import instructionsBody from "../docs/PROMPT_IA_PROJECT_INSTRUCTIONS.md?raw";
import scopeDeltas from "../docs/PROMPT_IA_SCOPE_INSTRUCTIONS.md?raw";
import buildPromptIaProjectContext from "../utils/buildPromptIaProjectContext";
import {
  describePromptIaEntries,
  generatePromptIaZip,
} from "./buildPromptIaProjectZip";

// INSTRUCTIONS.md of a Krto (single scope) zip: the request, the deltas
// specific to a scope inside an existing project, then the shared body of
// the project instructions (same output format: projet.json + pdfs/).
export function buildScopeInstructionsMarkdown(context) {
  const scopeName = context.scope?.name ?? "nouveau Krto";
  const projectName = context.project.name ?? "projet existant";
  const files = context.files.map(
    (f) => `- \`${f.path}\`${f.pageCount ? ` — ${f.pageCount} page(s)` : ""}`
  );
  const lines = [
    `# Création d'un Krto — ${scopeName}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le zip demandé dans",
    "> la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Projet existant** : ${projectName}${
      context.project.clientRef ? ` (n° ${context.project.clientRef})` : ""
    }`,
    "",
    `**Krto à créer** : ${scopeName}`,
    "",
    "**Description**",
    "",
    context.scopesDescription,
    "",
    "**Fichiers**",
    "",
    "- `contexte.json` — données de la demande (à lire en premier)",
    ...(files.length ? files : ["- (aucune donnée d'entrée)"]),
    "",
    "## Consignes propres à ce Krto",
    "",
    scopeDeltas.trim(),
    "",
    "---",
    "",
    instructionsBody.trim(),
    "",
  ];
  return lines.join("\n");
}

/**
 * Builds and downloads `prompt-ia-krto-<name>.zip`: INSTRUCTIONS.md,
 * contexte.json (`kind: "SCOPE"`) and the input files under `donnees/`.
 *
 * @param {Object} params
 * @param {{name?: string, clientRef?: string}} params.project - existing project
 * @param {string} params.scopeName - name of the Krto under creation
 * @param {string} params.description - what to create, in the user's words
 * @param {Array<{path: string, file: File}>} params.entries
 * @returns {Promise<{fileName: string, sizeBytes: number, unreadablePdfs: string[], blob: Blob}>}
 */
export default async function buildPromptIaScopeZip({
  project,
  scopeName,
  description,
  entries = [],
  download = true,
}) {
  const { files, unreadablePdfs } = await describePromptIaEntries(entries);
  const context = buildPromptIaProjectContext({
    project,
    description,
    files,
    scope: { name: scopeName },
  });
  const blob = await generatePromptIaZip({
    instructions: buildScopeInstructionsMarkdown(context),
    context,
    entries,
  });
  const fileName = `prompt-ia-krto-${slugify(scopeName || "krto")}.zip`;
  if (download) downloadBlob(blob, fileName);

  return { fileName, sizeBytes: blob.size, unreadablePdfs, blob };
}
