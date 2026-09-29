import JSZip from "jszip";
import { nanoid } from "@reduxjs/toolkit";

import { isIgnoredPath } from "../utils/readDroppedEntries";
import parsePromptIaProjectOutput, {
  normalizeZipPath,
} from "../utils/parsePromptIaProjectOutput";

const PROJECT_JSON = "projet.json";

const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const getImageType = (path) =>
  IMAGE_TYPES[path.split(".").pop().toLowerCase()] ?? null;

// Models often wrap everything in one top folder ("projet/…"): drop it so the
// paths match the ones written in projet.json.
function getCommonRoot(paths) {
  if (!paths.length) return "";
  const first = paths[0].split("/");
  if (first.length < 2) return "";
  const root = `${first[0]}/`;
  return paths.every((p) => p.startsWith(root)) ? root : "";
}

function pickJsonPath(paths) {
  const jsons = paths.filter((p) => /\.json$/i.test(p));
  return (
    jsons.find((p) => p.toLowerCase() === PROJECT_JSON) ??
    jsons.find((p) => p.toLowerCase().endsWith(`/${PROJECT_JSON}`)) ??
    jsons.sort((a, b) => a.split("/").length - b.split("/").length)[0] ??
    null
  );
}

/**
 * Reads the zip returned by the AI chat: `projet.json` + the PDFs + the
 * satellite image of the site when there is one + the documents (CCTP…)
 * the business objects point to.
 *
 * @param {File|Blob} file
 * @returns {Promise<{ok: true, data: Object, summary: Object, pdfFilesByPath: Map<string, File>, referenceImageFile: File|null, documentFilesByPath: Map<string, File>}
 *   | {ok: false, error: string}>}
 */
export default async function readPromptIaProjectOutputZip(file) {
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    return { ok: false, error: `Zip illisible : ${e?.message ?? String(e)}` };
  }

  const zipFiles = Object.values(zip.files).filter(
    (f) => !f.dir && !isIgnoredPath(f.name)
  );
  const root = getCommonRoot(zipFiles.map((f) => normalizeZipPath(f.name)));
  const byPath = new Map(
    zipFiles.map((f) => [normalizeZipPath(f.name).slice(root.length), f])
  );

  const jsonPath = pickJsonPath([...byPath.keys()]);
  if (!jsonPath)
    return {
      ok: false,
      error: "Le zip ne contient pas de fichier projet.json.",
    };

  let json;
  try {
    json = JSON.parse(await byPath.get(jsonPath).async("string"));
  } catch (e) {
    return { ok: false, error: `${jsonPath} invalide : ${e.message}` };
  }

  const pdfPaths = [...byPath.keys()].filter((p) => /\.pdf$/i.test(p));
  const imagePaths = [...byPath.keys()].filter((p) => getImageType(p));
  const parsed = parsePromptIaProjectOutput(json, {
    pdfPaths,
    imagePaths,
    filePaths: [...byPath.keys()].filter((p) => p !== jsonPath),
    newId: nanoid,
  });
  if (!parsed.ok) return parsed;

  // Only the PDFs a base map uses are extracted.
  const pdfFilesByPath = new Map();
  for (const baseMap of parsed.data.baseMaps) {
    const path = baseMap.source.file;
    if (pdfFilesByPath.has(path)) continue;
    const blob = await byPath.get(path).async("blob");
    pdfFilesByPath.set(
      path,
      new File([blob], path.split("/").pop(), { type: "application/pdf" })
    );
  }

  let referenceImageFile = null;
  const referencePath = parsed.data.site.reference?.file;
  if (referencePath) {
    const blob = await byPath.get(referencePath).async("blob");
    referenceImageFile = new File([blob], referencePath.split("/").pop(), {
      type: getImageType(referencePath),
    });
  }

  const documentFilesByPath = new Map();
  for (const document of parsed.data.documents) {
    const path = document.file;
    if (documentFilesByPath.has(path)) continue;
    const blob = await byPath.get(path).async("blob");
    const fileName = path.split("/").pop();
    documentFilesByPath.set(
      path,
      new File([blob], fileName, {
        type: /\.pdf$/i.test(path)
          ? "application/pdf"
          : (getImageType(path) ?? blob.type),
      })
    );
  }

  return {
    ...parsed,
    pdfFilesByPath,
    referenceImageFile,
    documentFilesByPath,
  };
}
