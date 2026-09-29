import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import fileToWorkbook from "Features/excel/utils/fileToWorkbook";
import {
  slugify,
  attachmentEntryName,
} from "Features/promptIa/services/buildPromptIaZip";

import instructionsBody from "../docs/PROMPT_IA_BUSINESS_OBJECTS_INSTRUCTIONS.md?raw";

const ATTACHMENTS_DIR = "pieces-jointes";
const CSV_SEPARATOR = ";";

// Already-compressed formats are stored as-is.
const STORED_FILE_REGEX = /\.(xlsx|docx|pptx|pdf|png|jpe?g|webp|zip)$/i;

function cellToText(cell) {
  let value = cell?.value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText))
      value = value.richText.map((part) => part.text).join("");
    else if ("result" in value) value = value.result;
    else if ("formula" in value || "sharedFormula" in value) value = "";
    else if ("text" in value) value = value.text;
    else if ("error" in value) value = "";
    else value = "";
  }
  if (value == null || typeof value === "object") return "";
  if (typeof value === "number") return String(Math.round(value * 1e6) / 1e6);
  return String(value);
}

function toCsvField(text) {
  const flat = text.replace(/\r?\n/g, " ").trim();
  return /[";]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

// One CSV per non-empty sheet, computed formula values: a model that cannot
// open the workbook still reads the rows.
async function buildWorkbookCsvs(file) {
  const workbook = await fileToWorkbook(file);
  const csvs = [];
  workbook.eachSheet((sheet) => {
    const lines = [];
    const columnCount = sheet.columnCount;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const fields = [];
      for (let c = 1; c <= columnCount; c++)
        fields.push(toCsvField(cellToText(row.getCell(c))));
      if (fields.some(Boolean)) lines.push(fields.join(CSV_SEPARATOR));
    });
    if (lines.length > 0) csvs.push({ sheetName: sheet.name, lines });
  });
  return csvs;
}

export function buildBusinessObjectsInstructionsMarkdown({ context }) {
  const files = [
    "- `contexte.json` — données de la demande (à lire en premier)",
    ...context.attachments.flatMap((a) => [
      `- \`${a.file}\` — pièce jointe`,
      ...a.csvs.map(
        (csv) =>
          `- \`${csv.file}\` — export CSV de la feuille « ${csv.sheetName} » (${csv.rowCount} lignes)`
      ),
    ]),
  ];
  const lines = [
    `# Liste « ${context.listing.objectsLabel} » — ${context.listing.name ?? "nouvelle liste"}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le JSON demandé dans",
    "> la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Liste à créer** : ${context.listing.name ?? "(nom à proposer dans `listingName`)"} — type « ${context.listing.objectsLabel} ».`,
    "",
    ...(context.instruction
      ? ["**Instruction de l'utilisateur**", "", context.instruction, ""]
      : [
          "**Instruction de l'utilisateur** : aucune — applique les règles par défaut.",
          "",
        ]),
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
 * Builds and downloads `prompt-ia-ouvrages-<name>.zip`: INSTRUCTIONS.md,
 * contexte.json and the dropped files under `pieces-jointes/` (plus one CSV
 * per sheet of every .xlsx). The files stay in memory: nothing is stored in
 * the project.
 *
 * @param {{listingName?: string, type: Object, instruction?: string,
 *   files: File[], download?: boolean}} params — `type`: entry of
 *   businessObjectTypesCatalog
 * @returns {Promise<{fileName: string, files: string[], sizeBytes: number,
 *   warnings: string[], blob: Blob}>}
 */
export default async function buildPromptIaBusinessObjectsZip({
  listingName,
  type,
  instruction,
  files = [],
  download = true,
}) {
  const zip = new JSZip();
  const taken = new Set();
  const entries = [];
  const warnings = [];
  const attachments = [];

  for (const file of files) {
    const entry = `${ATTACHMENTS_DIR}/${attachmentEntryName(file.name, taken)}`;
    zip.file(entry, file, {
      compression: STORED_FILE_REGEX.test(file.name) ? "STORE" : "DEFLATE",
    });
    entries.push(entry);

    const csvs = [];
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const stem = file.name.replace(/\.xlsx$/i, "");
        for (const { sheetName, lines } of await buildWorkbookCsvs(file)) {
          const csvEntry = `${ATTACHMENTS_DIR}/${attachmentEntryName(
            `${stem}__${slugify(sheetName)}.csv`,
            taken
          )}`;
          // BOM: the accents survive a spreadsheet opening
          zip.file(csvEntry, `\uFEFF${lines.join("\n")}\n`);
          entries.push(csvEntry);
          csvs.push({ file: csvEntry, sheetName, rowCount: lines.length });
        }
      } catch (err) {
        warnings.push(
          `Export CSV de « ${file.name} » impossible (${
            err?.message ?? String(err)
          }) : le fichier d'origine est joint tel quel.`
        );
      }
    }

    attachments.push({
      name: file.name,
      file: entry,
      mime: file.type || null,
      byteSize: file.size ?? null,
      csvs,
    });
  }

  const name = listingName?.trim() || null;
  const context = {
    version: "1.0",
    listing: {
      name,
      businessObjectType: type?.key ?? null,
      objectsLabel: type?.defaultLabel ?? "Ouvrages",
    },
    instruction: instruction?.trim() || null,
    units: {
      freeText: true,
      note: "unité recopiée telle qu'écrite dans le document, null sans unité",
    },
    attachments,
    output: {
      rootKeys: ["version", "listingName", "note", "businessObjects"],
      itemKeys: [
        "id",
        "parentId",
        "label",
        "code",
        "isTitle",
        "unit",
        "refQty",
        "description",
      ],
      singleLine: true,
    },
  };

  zip.file(
    "INSTRUCTIONS.md",
    buildBusinessObjectsInstructionsMarkdown({ context })
  );
  zip.file("contexte.json", JSON.stringify(context, null, 2));

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const fileName = `prompt-ia-ouvrages-${slugify(name ?? "liste")}.zip`;
  if (download) downloadBlob(blob, fileName);

  return {
    fileName,
    files: ["INSTRUCTIONS.md", "contexte.json", ...entries],
    sizeBytes: blob.size,
    warnings,
    blob,
  };
}
