import JSZip from "jszip";

import { isIgnoredPath } from "./readDroppedEntries";

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  json: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dxf: "image/vnd.dxf",
};

export function getMimeFromPath(path) {
  const extension = String(path).split(".").pop()?.toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "";
}

const isZip = (path) => /\.zip$/i.test(path);

/**
 * Replaces every dropped `.zip` by its content, under a folder named after
 * the zip. One level only: a zip inside a zip stays a file. A zip that cannot
 * be read is kept as is.
 *
 * @param {Array<{path: string, file: File}>} entries
 * @returns {Promise<Array<{path: string, file: File}>>}
 */
export default async function expandZipFiles(entries) {
  const out = [];
  for (const entry of entries) {
    if (!isZip(entry.path)) {
      out.push(entry);
      continue;
    }
    try {
      const zip = await JSZip.loadAsync(entry.file);
      const folder = entry.path.replace(/\.zip$/i, "");
      const inner = Object.values(zip.files).filter(
        (f) => !f.dir && !isIgnoredPath(f.name)
      );
      for (const zipFile of inner) {
        const blob = await zipFile.async("blob");
        const name = zipFile.name.split("/").pop();
        out.push({
          path: `${folder}/${zipFile.name}`,
          file: new File([blob], name, {
            type: getMimeFromPath(name),
            lastModified: zipFile.date?.getTime?.() ?? Date.now(),
          }),
        });
      }
    } catch (e) {
      console.warn(
        "[promptIaProject] unreadable zip kept as is",
        entry.path,
        e
      );
      out.push(entry);
    }
  }
  return out;
}

// Two drops may bring the same path: the later one gets a numeric suffix.
export function mergeEntries(existing, added) {
  const taken = new Set(existing.map((e) => e.path.toLowerCase()));
  const merged = [...existing];
  for (const entry of added) {
    const dot = entry.path.lastIndexOf(".");
    const slash = entry.path.lastIndexOf("/");
    const hasExtension = dot > slash + 1;
    const stem = hasExtension ? entry.path.slice(0, dot) : entry.path;
    const extension = hasExtension ? entry.path.slice(dot) : "";
    let path = entry.path;
    for (let n = 2; taken.has(path.toLowerCase()); n++)
      path = `${stem}-${n}${extension}`;
    taken.add(path.toLowerCase());
    merged.push({ ...entry, path });
  }
  return merged;
}
