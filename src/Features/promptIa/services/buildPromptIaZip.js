import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import { buildBaseMapSnapshotBlob } from "Features/assistantRelay/services/buildBaseMapSnapshotImage";

import instructionsBody from "../docs/PROMPT_IA_INSTRUCTIONS.md?raw";
import buildPromptIaContext from "./buildPromptIaContext";
import loadSourcePdf from "./loadSourcePdf";
import readPdfPageFrame from "./readPdfPageFrame";

// Long edge of plan.png: sharp enough for vision models to read thin walls
// and small texts, small enough for a chat upload.
export const PLAN_IMAGE_LONG_EDGE = 3000;

export function slugify(text) {
  return (
    String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "plan"
  );
}

function describeMode(mode) {
  if (mode.fromTemplates && mode.free)
    return "Les deux : d’abord les modèles existants, puis de nouveaux modèles pour la description ci-dessous.";
  if (mode.fromTemplates)
    return "À partir des modèles : uniquement les `templates` de `contexte.json`, sans en créer d’autres (sauf « À vérifier »).";
  return "Détection libre : définis les modèles nécessaires à la description ci-dessous.";
}

export function buildInstructionsMarkdown({ context, hasPdf }) {
  const files = [
    "- `contexte.json` — données du plan (à lire en premier)",
    `- \`plan.png\` — image du fond (${context.plan.image.width} × ${context.plan.image.height} px)`,
    hasPdf
      ? `- \`plan.pdf\` — page PDF source (page ${context.source.pageNumber})`
      : "- (pas de PDF source : travaille sur `plan.png`, voie B)",
  ];
  const lines = [
    `# Détection d'annotations — ${context.plan.name ?? "fond de plan"}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le JSON demandé dans",
    "> la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Mode** : ${describeMode(context.mode)}`,
    "",
    ...(context.mode.free && context.mode.description
      ? ["**Que faut-il repérer ?**", "", context.mode.description, ""]
      : []),
    `**Liste cible** : ${context.listing?.name ?? "liste courante"} — ${context.templates.length} modèle(s) fourni(s), ${context.existingAnnotationsTotal} annotation(s) déjà dessinée(s).`,
    "",
    context.plan.widthMeters
      ? `**Échelle** : l'image \`plan.png\` représente ${context.plan.widthMeters} m de large (${context.plan.meterByPx} m par pixel de référence).`
      : "**Échelle** : inconnue (fond non calibré) — n'invente pas de calibration.",
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
 * Builds and downloads `prompt-ia-<plan>.zip`: INSTRUCTIONS.md, plan.png
 * (reference frame), plan.pdf when the source PDF is available locally, and
 * contexte.json.
 *
 * @returns {Promise<{fileName:string, files:string[], hasPdf:boolean, pdfReason:string|null, sizeBytes:number}>}
 */
export default async function buildPromptIaZip({
  baseMap,
  projectId,
  listing,
  templates,
  annotations,
  mode,
  download = true,
}) {
  const picture = await buildBaseMapSnapshotBlob({
    baseMap,
    mime: "image/png",
    maxLongEdge: PLAN_IMAGE_LONG_EDGE,
  });

  const pdf = await loadSourcePdf({ baseMap, projectId });
  let source = null;
  if (pdf.file) {
    const page = await readPdfPageFrame(pdf.file, pdf.frame.pageNumber);
    source = {
      pageNumber: pdf.frame.pageNumber,
      rotation: pdf.frame.rotation,
      bboxInRatio: pdf.frame.bboxInRatio,
      page: { view: page.view, rotate: page.rotate },
    };
  }

  const context = buildPromptIaContext({
    baseMap,
    image: { width: picture.width, height: picture.height },
    source,
    listing,
    templates,
    annotations,
    mode,
  });
  const instructions = buildInstructionsMarkdown({
    context,
    hasPdf: Boolean(pdf.file),
  });

  const zip = new JSZip();
  zip.file("INSTRUCTIONS.md", instructions);
  zip.file("contexte.json", JSON.stringify(context, null, 2));
  // PNG / PDF are already compressed: store them as-is.
  zip.file("plan.png", picture.blob, { compression: "STORE" });
  if (pdf.file) zip.file("plan.pdf", pdf.file, { compression: "STORE" });

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true,
  });
  const fileName = `prompt-ia-${slugify(baseMap.name)}.zip`;
  if (download) downloadBlob(blob, fileName);

  return {
    fileName,
    files: [
      "INSTRUCTIONS.md",
      "contexte.json",
      "plan.png",
      ...(pdf.file ? ["plan.pdf"] : []),
    ],
    hasPdf: Boolean(pdf.file),
    pdfReason: pdf.reason,
    sizeBytes: blob.size,
    blob,
  };
}
