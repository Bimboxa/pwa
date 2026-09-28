import db from "App/db/db";
import { describeAiTaskSource } from "Features/aiTasks/utils/aiTaskSource";

/**
 * The PDF page a base map was cut out of, read from the local Dexie store
 * (no relay). Mirrors the loading part of resolveAiTaskSource without the
 * upload.
 *
 * Never throws: a base map that does not come from a PDF, or whose PDF is not
 * downloaded, yields `{ file: null, reason }` so the caller can degrade to the
 * picture alone.
 *
 * @returns {Promise<{file: Blob|null, fileName: string|null, frame: Object|null,
 *   sourceImageSize: Object|null, reason: string|null}>}
 */
export default async function loadSourcePdf({ baseMap, projectId }) {
  let source;
  try {
    source = describeAiTaskSource(baseMap);
  } catch (err) {
    return {
      file: null,
      fileName: null,
      frame: null,
      sourceImageSize: null,
      reason: err?.message ?? "Ce fond de plan ne provient pas d’un PDF.",
    };
  }
  const cf = baseMap.createdFrom;
  const resource = cf.resourceId ? await db.resources.get(cf.resourceId) : null;
  if (!resource || resource.deletedAt || resource.projectId !== projectId) {
    return {
      file: null,
      fileName: source.fileName,
      frame: source.frame,
      sourceImageSize: source.sourceImageSize,
      reason: "Le PDF source est introuvable dans les ressources du projet.",
    };
  }
  const record = await db.files.get(resource.fileName);
  if (!record?.fileArrayBuffer) {
    return {
      file: null,
      fileName: source.fileName,
      frame: source.frame,
      sourceImageSize: source.sourceImageSize,
      reason:
        "Le PDF source n’est pas téléchargé. Ouvrez-le dans les ressources avant de réessayer.",
    };
  }
  return {
    file: new Blob([record.fileArrayBuffer], { type: "application/pdf" }),
    fileName: source.fileName,
    frame: source.frame,
    sourceImageSize: source.sourceImageSize,
    reason: null,
  };
}
