import db from "App/db/db";

import parseScene3dGlb, { disposeScene3dGlbModel } from "../js/parseScene3dGlb";

// Parsed GLB models of the scan base maps (scene3d.format "GLB"), shared and
// ref-counted: one parse per file (a heavy model takes seconds), whatever
// the number of base map groups showing it — each one attaches its own clone
// (cloneScene3dGlbModel, shared geometries). Eviction is delayed so a
// display toggle or a 2D ↔ 3D round trip never parses twice.
//
// The file lives in db.files (`fileBlob`), written at the creation of the
// base map. A missing file (base map received on another device) → null.

const EVICTION_DELAY_MS = 15000;

// fileName → {promise: Promise<model|null>, refs, timer}
const entries = new Map();

async function loadModel(fileName) {
  const row = await db.files.get(fileName);
  const source = row?.fileBlob ?? row?.fileArrayBuffer ?? null;
  if (!source) return null;
  const buffer =
    source instanceof ArrayBuffer ? source : await source.arrayBuffer();
  return parseScene3dGlb(buffer);
}

function evict(fileName) {
  const entry = entries.get(fileName);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entries.delete(fileName);
  entry.promise.then(
    (model) => model && disposeScene3dGlbModel(model),
    () => {}
  );
}

/**
 * @param {string} fileName - db.files key of the GLB
 * @returns {{promise: Promise<object|null>, release: () => void}} promise:
 *   the parsed model (parseScene3dGlb), null when the file is not on this
 *   device; rejects when the file cannot be parsed.
 */
export function acquireScene3dGlb(fileName) {
  let entry = entries.get(fileName);
  if (!entry) {
    entry = { promise: loadModel(fileName), refs: 0, timer: null };
    entries.set(fileName, entry);
    // a failed parse is not cached
    entry.promise.catch(() => {
      if (entries.get(fileName) === entry) entries.delete(fileName);
    });
  }
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.refs += 1;
  let released = false;
  return {
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      entry.refs -= 1;
      if (entry.refs > 0 || entries.get(fileName) !== entry) return;
      entry.timer = setTimeout(() => evict(fileName), EVICTION_DELAY_MS);
    },
  };
}

// The model parsed by the creation dialog becomes the cached one: the 3D
// editor never parses the file a second time.
export function seedScene3dGlb(fileName, model) {
  evict(fileName);
  const entry = { promise: Promise.resolve(model), refs: 0, timer: null };
  entries.set(fileName, entry);
  entry.timer = setTimeout(() => evict(fileName), EVICTION_DELAY_MS);
}

// The file changed or went away (reload, deletion): the next acquire reads
// it again. Clones still attached keep their (disposed) geometries until
// their group re-syncs.
export function evictScene3dGlb(fileName) {
  evict(fileName);
}
