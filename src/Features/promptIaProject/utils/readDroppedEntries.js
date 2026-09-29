// Reads a drop (files AND folders) into a flat list of { path, file }, the
// folder tree kept in `path`. Folders are only reachable through the entries
// API: `dataTransfer.files` lists a folder as an unreadable pseudo-file.

const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

export function isIgnoredPath(path) {
  return String(path)
    .split("/")
    .some((part) => part === "__MACOSX" || IGNORED_NAMES.has(part));
}

function readFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

// readEntries returns the children by batches (100 in Chrome): call it until
// it yields an empty batch.
async function readChildren(directoryEntry) {
  const reader = directoryEntry.createReader();
  const children = [];
  for (;;) {
    const batch = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (!batch.length) return children;
    children.push(...batch);
  }
}

async function walk(entry, parentPath, out) {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (isIgnoredPath(path)) return;
  if (entry.isFile) {
    out.push({ path, file: await readFile(entry) });
    return;
  }
  if (!entry.isDirectory) return;
  const children = await readChildren(entry);
  children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of children) await walk(child, path, out);
}

/**
 * Must be called synchronously from the drop handler: the DataTransfer items
 * are no longer readable once the event has been dispatched.
 *
 * @returns {Promise<Array<{path: string, file: File}>>}
 */
export default function readDroppedEntries(dataTransfer) {
  const roots = [];
  const plainFiles = [];
  for (const item of Array.from(dataTransfer?.items ?? [])) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) roots.push(entry);
    else {
      const file = item.getAsFile();
      if (file) plainFiles.push(file);
    }
  }
  if (!roots.length && !plainFiles.length)
    plainFiles.push(...Array.from(dataTransfer?.files ?? []));

  return (async () => {
    const out = plainFiles
      .filter((file) => !isIgnoredPath(file.name))
      .map((file) => ({ path: file.name, file }));
    for (const root of roots) await walk(root, "", out);
    return out;
  })();
}
