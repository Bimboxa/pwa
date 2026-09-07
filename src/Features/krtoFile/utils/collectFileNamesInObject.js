// Deep-collect every nested `fileName` string reference found in an object
// graph (read-only mirror of rewriteFileNamesInObject in remapDexieExportIds).
// Used by the project exporter to catch db.files rows referenced by an
// exported row but not selected by the projectId / listingId predicates
// (legacy rows written without those fields).
export default function collectFileNamesInObject(
  obj,
  target = new Set(),
  seen = new WeakSet()
) {
  if (!obj || typeof obj !== "object") return target;
  if (seen.has(obj)) return target;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (const item of obj) collectFileNamesInObject(item, target, seen);
    return target;
  }
  if (typeof obj.fileName === "string" && obj.fileName) {
    target.add(obj.fileName);
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "fileArrayBuffer") continue;
    if (v && typeof v === "object") collectFileNamesInObject(v, target, seen);
  }
  return target;
}
