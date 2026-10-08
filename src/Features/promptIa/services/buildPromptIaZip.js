import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import extractPdfPage from "Features/pdf/utils/extractPdfPage";
import { buildBaseMapSnapshotBlob } from "Features/assistantRelay/services/buildBaseMapSnapshotImage";

import instructionsBody from "../docs/PROMPT_IA_INSTRUCTIONS.md?raw";
import buildPromptIaContext from "./buildPromptIaContext";
import buildPromptIaHeightMapImages from "./buildPromptIaHeightMapImages";
import loadSourcePdf from "./loadSourcePdf";
import readPdfPageFrame, { readPdfPageFrames } from "./readPdfPageFrame";
import {
  getFileExtension,
  getPromptIaAttachmentKind,
  isCompressibleAttachment,
} from "../utils/promptIaAttachmentTypes";
import summarizeDxf from "../utils/summarizeDxf";
import summarizeIfc from "../utils/summarizeIfc";

const ATTACHMENTS_DIR = "pieces-jointes";
export const RESULT_ZIP_FILE = "resultat.zip";
export const RESULT_JSON_FILE = "resultat.json";
export const HEIGHT_MAP_FILE = "hauteurs.png";
export const HEIGHT_MAP_PREVIEW_FILE = "hauteurs-apercu.png";

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

// Digest of a CAD / BIM attachment for contexte.json (`attachments[].cad`).
// Never fatal: the model reads the file itself anyway.
async function summarizeCadAttachment({ name, kind, file }) {
  try {
    if (kind === "DXF") return summarizeDxf(await file.arrayBuffer());
    if (kind === "IFC" && getFileExtension(name) === "ifc")
      return summarizeIfc(await file.text());
  } catch (err) {
    console.warn("[promptIa] CAD summary failed", name, err);
  }
  return null;
}

function describeCad(cad) {
  if (cad?.format === "DXF")
    return `, DXF ${cad.unit?.name ?? ""} — ${cad.layerCount} calque(s), ${cad.entityCount} entité(s)`;
  if (cad?.format === "IFC")
    return `, ${cad.schema ?? "IFC"} — ${cad.storeys.length} niveau(x), ${cad.elementCount} élément(s)`;
  return "";
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
  const heightMap = context.plan.heightMap;
  const files = [
    "- `contexte.json` — données du plan (à lire en premier)",
    `- \`plan.png\` — image du fond (${context.plan.image.width} × ${context.plan.image.height} px)`,
    hasPdf
      ? `- \`plan.pdf\` — la page PDF source du fond, seule${
          context.source.sourcePageNumber &&
          context.source.sourcePageNumber !== context.source.pageNumber
            ? ` (page ${context.source.sourcePageNumber} du document d'origine)`
            : ""
        }`
      : "- (pas de PDF source : travaille sur `plan.png`, voie B)",
    ...(heightMap
      ? [
          `- \`${heightMap.file}\` — carte des hauteurs du scan, même taille que \`plan.png\` (0 → ${heightMap.zMax} m au-dessus du plan, encodage RG16, voir \`plan.heightMap\`)`,
          `- \`${heightMap.previewFile}\` — aperçu en niveaux de gris de la carte des hauteurs (clair = haut)`,
        ]
      : []),
    ...context.attachments.map(
      (a) =>
        `- \`${a.file}\` — pièce jointe \`${a.id}\`${
          a.pageCount ? `, ${a.pageCount} page(s)` : ""
        }${describeCad(a.cad)}`
    ),
  ];
  const cadSources = context.attachments.filter(
    (a) => a.kind === "DXF" || a.kind === "IFC"
  );
  const lines = [
    `# Détection d'annotations — ${context.plan.name ?? "fond de plan"}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le résultat demandé",
    "> dans la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Mode** : ${describeMode(context.mode)}`,
    "",
    "**Périmètre** : uniquement ce fond de plan (`plan.png`, et la page de `plan.pdf`). N'annote aucune autre page, aucun autre plan et aucune autre pièce jointe, sauf consigne explicite.",
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
    ...(heightMap
      ? [
          `**Relief** : le fond est un scan 3D. \`${heightMap.file}\` donne la hauteur du terrain et des ouvrages au-dessus du plan (0 → ${heightMap.zMax} m, cellule ${heightMap.cellSizeM} m). Renseigne \`offsetZ\`, \`height\`, \`offsetTop\` / \`offsetBottom\` à partir de ces valeurs (section « Relief et hauteurs (3D) »).`,
          "",
        ]
      : []),
    ...(cadSources.length
      ? [
          `**Sources CAO / BIM** : ${cadSources
            .map((a) => `\`${a.file}\` (${a.kind})`)
            .join(
              ", "
            )}. Crée un fond de plan et une liste d'annotations par source, puis compare les sources entre elles (sections « Sources CAO / BIM », « Fonds de plan créés », « Une liste par source », « Points d'attention »). La réponse est alors le zip \`${RESULT_ZIP_FILE}\`.`,
          "",
        ]
      : []),
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
 * contexte.json and the attached files under `pieces-jointes/` (PDF,
 * pictures, DXF / IFC sources with their digest in contexte.json).
 *
 * `attachments` = [{ resource, file }] (file: File/Blob read from db.files).
 *
 * @returns {Promise<{fileName:string, files:string[], hasPdf:boolean, pdfReason:string|null, hasHeightMap:boolean, heightMapZMax:number|null, heightMapReason:string|null, sizeBytes:number}>}
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

  // Scan base map: its height map, in the pixel frame of plan.png.
  let relief = null;
  let heightMapReason = null;
  if (baseMap?.scene3d?.sceneId) {
    try {
      const built = await buildPromptIaHeightMapImages({
        baseMap,
        image: { width: picture.width, height: picture.height },
        projectId,
      });
      if (built?.blob) relief = built;
      else heightMapReason = built?.reason ?? "Relief indisponible.";
    } catch (err) {
      console.error("[promptIa] height map failed", err);
      heightMapReason = err?.message ?? String(err);
    }
  }

  // plan.pdf = the source page ALONE: the model must not detect on the other
  // pages of the document. Falls back to the whole file when the extraction
  // fails. The import converts `pdf_user_space` results with the original
  // file and frame (same page geometry), so only the zip-side numbering
  // changes.
  const pdf = await loadSourcePdf({ baseMap, projectId });
  let source = null;
  let planPdf = null;
  if (pdf.file) {
    let pageNumber = pdf.frame.pageNumber;
    try {
      planPdf = await extractPdfPage(pdf.file, pdf.frame.pageNumber);
      pageNumber = 1;
    } catch (err) {
      console.warn("[promptIa] single page extraction failed", err);
      planPdf = pdf.file;
    }
    const page = await readPdfPageFrame(planPdf, pageNumber);
    source = {
      pageNumber,
      sourcePageNumber: pdf.frame.pageNumber,
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
    const kind = getPromptIaAttachmentKind(resource.name);
    attached.push({
      id: resource.id,
      name: resource.name,
      kind,
      cad: await summarizeCadAttachment({ name: resource.name, kind, file }),
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
    heightMap: relief
      ? {
          file: HEIGHT_MAP_FILE,
          previewFile: HEIGHT_MAP_PREVIEW_FILE,
          width: relief.width,
          height: relief.height,
          zMax: relief.zMax,
          coverage: relief.coverage,
          cellSizeM: relief.cellSizeM,
        }
      : null,
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
  if (planPdf) zip.file("plan.pdf", planPdf, { compression: "STORE" });
  if (relief) {
    zip.file(HEIGHT_MAP_FILE, relief.blob, { compression: "STORE" });
    zip.file(HEIGHT_MAP_PREVIEW_FILE, relief.previewBlob, {
      compression: "STORE",
    });
  }
  // DXF / IFC are plain text: deflated (÷ 5 to 10), unlike PDF / pictures.
  for (const a of attached)
    zip.file(a.file, a.blob, {
      compression: isCompressibleAttachment(a.name) ? "DEFLATE" : "STORE",
    });

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
      ...(relief ? [HEIGHT_MAP_FILE, HEIGHT_MAP_PREVIEW_FILE] : []),
      ...attached.map((a) => a.file),
    ],
    hasPdf: Boolean(pdf.file),
    pdfReason: pdf.reason,
    hasHeightMap: Boolean(relief),
    heightMapZMax: relief?.zMax ?? null,
    heightMapReason,
    sizeBytes: blob.size,
    blob,
  };
}
