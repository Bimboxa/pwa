import JSZip from "jszip";

import { readProjectExportManifest } from "Features/projects/utils/projectExportFormat";

// Routes a dropped .zip BEFORE any loader runs: loadKrtoZip takes the first
// `.json` entry of a zip as the dexie export, so a project export (which
// carries a manifest.json) must never reach it.
//
// @returns {Promise<{kind: "PROJECT_EXPORT", manifest: object} | {kind: "KRTO"}>}
export default async function detectImportZipKind(file) {
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("Format de fichier non reconnu");
  }

  const manifest = await readProjectExportManifest(zip);
  if (manifest) return { kind: "PROJECT_EXPORT", manifest };

  const hasJson = Object.values(zip.files).some(
    (f) => !f.dir && f.name.endsWith(".json")
  );
  if (!hasJson) throw new Error("Format de fichier non reconnu");

  return { kind: "KRTO" };
}
