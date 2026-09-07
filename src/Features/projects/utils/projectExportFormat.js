// Project export zip format (full debug dump of one project).
//
// Layout (kept identical to Krto zips for the data + images parts so the
// tooling around `project_data.json` / `images/` stays uniform):
//
//   <name>_<clientRef>_project_<timestamp>.zip
//   ├── manifest.json        # discriminator + metadata (this module)
//   ├── project_data.json    # dexie export, `files` rows WITHOUT fileArrayBuffer
//   └── images/<fileName>    # one binary per db.files row that carries one
//
// Krto zips (app + krto-init skill) never contain a manifest.json: its
// presence (with the right `kind`) is what routes a dropped zip to the
// project loader instead of loadKrtoZip.

import sanitizeName from "Features/misc/utils/sanitizeName";

export const PROJECT_EXPORT_KIND = "BIMBOXA_PROJECT_EXPORT";
export const PROJECT_EXPORT_FORMAT_VERSION = 1;
export const PROJECT_EXPORT_MANIFEST_FILE = "manifest.json";
export const PROJECT_EXPORT_DATA_FILE = "project_data.json";
export const PROJECT_EXPORT_IMAGES_DIR = "images/";

/**
 * Reads and validates the manifest of an opened JSZip archive.
 * @returns {Promise<object|null>} the manifest, or null when the zip is not a
 *   project export (no manifest, unparsable, or wrong kind).
 */
export async function readProjectExportManifest(zip) {
  const entry = zip?.file(PROJECT_EXPORT_MANIFEST_FILE);
  if (!entry) return null;
  try {
    const manifest = JSON.parse(await entry.async("text"));
    if (manifest?.kind !== PROJECT_EXPORT_KIND) return null;
    return manifest;
  } catch {
    return null;
  }
}

export function buildProjectExportFileName({ projectName, clientRef }) {
  const parts = [sanitizeName(projectName || "project")];
  if (clientRef) parts.push(sanitizeName(String(clientRef)));
  parts.push("project", String(Date.now()));
  return `${parts.join("_")}.zip`;
}
