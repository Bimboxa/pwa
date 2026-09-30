import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import { buildBaseMapSnapshotBlob } from "Features/assistantRelay/services/buildBaseMapSnapshotImage";

import instructionsBody from "../docs/PROMPT_IA_INSTRUCTIONS.md?raw";
import buildPromptIaContext from "./buildPromptIaContext";
import loadSourcePdf from "./loadSourcePdf";
import readPdfPageFrame, { readPdfPageFrames } from "./readPdfPageFrame";

const ATTACHMENTS_DIR = "pieces-jointes";

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

// Zip entry names must be unique and free of path separators.
export function attachmentEntryName(name, taken) {
  const clean =
    String(name ?? "")
      .replace(/[\\/]+/g, "-")
      .trim() || "piece-jointe";
  const dot = clean.lastIndexOf(".");
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  let candidate = clean;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++)
    candidate = `${stem}-${n}${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

const CARNET_MODE =
  "Carnet de détails : place une pastille DETAIL sur le plan pour chaque détail repéré et crée le fond de détail correspondant à partir des pièces jointes (section « Carnet de détails »).";

function describeMode(mode) {
  const detection = describeDetectionMode(mode);
  if (!mode.details) return detection;
  return detection ? `${detection} ${CARNET_MODE}` : CARNET_MODE;
}

function describeDetectionMode(mode) {
  if (!mode.fromTemplates && !mode.free) return "";
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
    ...context.attachments.map(
      (a) =>
        `- \`${a.file}\` — pièce jointe \`${a.id}\`${
          a.pageCount ? `, ${a.pageCount} page(s)` : ""
        }`
    ),
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
    ...(context.mode.description
      ? [
          // free / details: the description drives the detection; with the
          // listing's templates alone it only refines it
          context.mode.free || context.mode.details
            ? "**Que faut-il repérer ?**"
            : "**Précisions**",
          "",
          context.mode.description,
          "",
        ]
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
 * (reference frame), plan.pdf when the source PDF is available locally,
 * contexte.json and the attached files under `pieces-jointes/`.
 *
 * `attachments` = [{ resource, file }] (file: File/Blob read from db.files).
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
  attachments = [],
  detailBaseMaps = [],
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

  const taken = new Set();
  const attached = [];
  for (const { resource, file } of attachments) {
    if (!resource?.id || !file) continue;
    const entry = `${ATTACHMENTS_DIR}/${attachmentEntryName(
      resource.name,
      taken
    )}`;
    const isPdf = resource.fileType === "PDF" || /\.pdf$/i.test(resource.name);
    let frames = { pageCount: null, pages: [] };
    if (isPdf) {
      try {
        frames = await readPdfPageFrames(file);
      } catch (err) {
        throw new Error(
          `Pièce jointe « ${resource.name} » illisible : ${
            err?.message ?? String(err)
          }`
        );
      }
    }
    attached.push({
      id: resource.id,
      name: resource.name,
      file: entry,
      mime: resource.fileMime || file.type || null,
      byteSize: file.size ?? resource.fileSize ?? null,
      pageCount: frames.pageCount,
      pages: frames.pages,
      blob: file,
    });
  }

  const context = buildPromptIaContext({
    baseMap,
    image: { width: picture.width, height: picture.height },
    source,
    listing,
    templates,
    annotations,
    mode,
    attachments: attached,
    detailBaseMaps,
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
  for (const a of attached) zip.file(a.file, a.blob, { compression: "STORE" });

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
      ...attached.map((a) => a.file),
    ],
    hasPdf: Boolean(pdf.file),
    pdfReason: pdf.reason,
    sizeBytes: blob.size,
    blob,
  };
}
