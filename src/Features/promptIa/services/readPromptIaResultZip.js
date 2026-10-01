import JSZip from "jszip";

import { normalizeZipPath } from "Features/promptIaProject/utils/parsePromptIaProjectOutput";
import { isIgnoredPath } from "Features/promptIaProject/utils/readDroppedEntries";

const RESULT_JSON = "resultat.json";

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// Models often wrap everything in one top folder ("resultat/…"): drop it so
// the paths match the ones written in resultat.json.
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
    jsons.find((p) => p.toLowerCase() === RESULT_JSON) ??
    jsons.find((p) => p.toLowerCase().endsWith(`/${RESULT_JSON}`)) ??
    jsons.sort((a, b) => a.split("/").length - b.split("/").length)[0] ??
    null
  );
}

/**
 * Reads the zip an external AI chat returns to the chat « Prompt IA »:
 * `resultat.json` + the files of the base maps it created (`fonds/…`).
 * Nothing is validated here but the container.
 *
 * @param {File|Blob} file
 * @returns {Promise<{ok: true, text: string, jsonPath: string,
 *   zipPaths: string[], getFile: (path: string) => Promise<File|null>}
 *   | {ok: false, error: string}>}
 *   `text` = raw content of the json, `zipPaths` = the other entries.
 */
export default async function readPromptIaResultZip(file) {
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
      error: `Le zip ne contient pas de fichier ${RESULT_JSON}.`,
    };

  return {
    ok: true,
    text: await byPath.get(jsonPath).async("string"),
    jsonPath,
    zipPaths: [...byPath.keys()].filter((p) => p !== jsonPath),
    getFile: async (path) => {
      const entry = byPath.get(path);
      if (!entry) return null;
      const name = path.split("/").pop();
      const extension = name.split(".").pop().toLowerCase();
      return new File([await entry.async("blob")], name, {
        type: MIME_BY_EXTENSION[extension] ?? "",
      });
    },
  };
}
