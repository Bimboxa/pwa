const UNDO_TABLES = new Set([
  "annotations",
  "points",
  "portfolioBaseMapContainers",
  // Painted mesh parts (Features/meshPaint). Re-sync writes run in a
  // tx.derivedWrite transaction and push no entry.
  "meshPaints",
]);
const MAX_UNDO = 50;

let undoStack = [];
let redoStack = [];
let _skipUndo = false;
// Entries collected by withUndoGroup (null: no group open).
let _group = null;

export { UNDO_TABLES, _skipUndo };

export function withoutUndo(fn) {
  _skipUndo = true;
  return Promise.resolve(fn()).finally(() => {
    _skipUndo = false;
  });
}

// Runs `fn` as ONE undo step: the writes it makes are undone / redone
// together (a nested group joins the outer one).
export async function withUndoGroup(fn) {
  if (_group) return await fn();
  _group = [];
  try {
    return await fn();
  } finally {
    const entries = _group;
    _group = null;
    if (entries.length === 1) pushUndo(entries[0]);
    else if (entries.length > 1) pushUndo({ type: "group", entries });
  }
}

export function pushUndo(entry) {
  if (_skipUndo) return;
  // An assistant batch lands from its own transaction and has its own chat
  // undo (forgetAnnotationBatchUndo): never fold it into an unrelated group
  // left open by a concurrent user edit.
  if (_group && entry?.type !== "annotation_batch") {
    _group.push(entry);
    return;
  }
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  // New action invalidates redo stack
  redoStack = [];
}

// --- DEXIE HOOKS ---

// Deep copy of a stored row (rows are structured-cloneable by definition).
function cloneRow(row) {
  try {
    return structuredClone(row);
  } catch {
    return { ...row };
  }
}

// Applies a Dexie modification set (dotted key paths) to a plain object; an
// undefined value deletes the property (Dexie semantics).
function applyModifications(target, modifications) {
  Object.keys(modifications).forEach((keyPath) => {
    const path = keyPath.split(".");
    let node = target;
    for (let i = 0; i < path.length - 1; i++) {
      if (!node[path[i]] || typeof node[path[i]] !== "object") {
        node[path[i]] = {};
      }
      node = node[path[i]];
    }
    const last = path[path.length - 1];
    if (modifications[keyPath] === undefined) delete node[last];
    else node[last] = modifications[keyPath];
  });
  return target;
}

// Records an undo entry for every create / update of the UNDO_TABLES (deletes
// are recorded by db.js' soft-delete middleware). Writes of an assistant batch
// (own receipt) and derived writes (meshPaint re-sync) are not recorded.
export function registerUndoHooks(db, tableNames = UNDO_TABLES) {
  tableNames.forEach((tableName) => {
    db[tableName].hook("creating", function (primKey, obj, tx) {
      if (_skipUndo || tx?.annotationBatch || tx?.derivedWrite) return;
      const snapshot = { ...obj };
      this.onsuccess = (key) => {
        pushUndo({
          table: tableName,
          type: "create",
          key,
          before: null,
          after: { ...snapshot, id: key },
        });
      };
    });

    db[tableName].hook("updating", function (modifications, primKey, obj, tx) {
      if (_skipUndo || tx?.annotationBatch || tx?.derivedWrite) return;
      const before = { ...obj };
      // `modifications` is a getObjectDiff of the stored row: nested changes
      // arrive as dotted key paths ("geometry.polygons", "sync.syncedAt"),
      // so a shallow `{...obj, ...modifications}` would keep the OLD nested
      // objects and add junk dotted keys. Dexie hands onsuccess the full new
      // value for a put over an existing row (update / modify use it).
      const mods = { ...modifications };
      this.onsuccess = (updated) => {
        pushUndo({
          table: tableName,
          type: "update",
          key: primKey,
          before,
          after:
            updated && typeof updated === "object"
              ? cloneRow(updated)
              : applyModifications(cloneRow(obj), mods),
        });
      };
    });
  });
}

// --- UNDO / REDO ---

async function restoreBatch(db, entry, direction) {
  const [{ restoreAnnotationBatch }, { default: store }] = await Promise.all([
    import("../../Features/assistantRelay/services/annotationBatchService.js"),
    import("../store"),
  ]);
  const state = store.getState();
  await restoreAnnotationBatch(db, entry.key, direction, {
    projectId: state.projects.selectedProjectId,
    scopeId: state.scopes.selectedScopeId,
  });
}

async function getDb() {
  const { default: db } = await import("./db");
  return db;
}

// Tables whose rows carry the `updatedAt` read by derived-data staleness
// checks (meshPaint « à vérifier »: host / host points updatedAt >
// sync.syncedAt). An undo / redo is a user edit: re-stamp the write time
// instead of rolling it back.
const RESTAMP_ON_RESTORE_TABLES = new Set(["annotations", "points"]);

function getRestoreValue(entry, value) {
  if (!value || !RESTAMP_ON_RESTORE_TABLES.has(entry.table)) return value;
  const { updatedAt, updatedByUserIdMaster, ...rest } = value; // eslint-disable-line no-unused-vars
  return rest;
}

async function applyUndo(db, entry) {
  switch (entry.type) {
    case "group":
      // Last write first.
      for (const child of [...entry.entries].reverse()) {
        await applyUndo(db, child);
      }
      break;
    case "annotation_batch":
      await restoreBatch(db, entry, "undo");
      break;
    case "create":
      // Record didn't exist before → hard delete it
      await db[entry.table].delete(entry.key);
      break;
    case "update":
      // Restore the previous snapshot
      await db[entry.table].put(getRestoreValue(entry, entry.before));
      break;
    case "delete":
      // Record was soft-deleted → restore it
      await db[entry.table].put(getRestoreValue(entry, entry.before));
      break;
  }
}

async function applyRedo(db, entry) {
  switch (entry.type) {
    case "group":
      for (const child of entry.entries) await applyRedo(db, child);
      break;
    case "annotation_batch":
      await restoreBatch(db, entry, "redo");
      break;
    case "create":
      // Re-create the record
      await db[entry.table].put(getRestoreValue(entry, entry.after));
      break;
    case "update":
      // Re-apply the modification
      await db[entry.table].put(getRestoreValue(entry, entry.after));
      break;
    case "delete":
      // Re-apply the soft delete
      await db[entry.table].put(getRestoreValue(entry, entry.after));
      break;
  }
}

// `options.db` targets another Dexie instance (tests).
// Called after every successful undo / redo with {db, entry, direction}
// ("undo" | "redo"): derived data kept in sync with the restored rows (e.g.
// meshPaint sync stamps, see db.js). Errors are logged, never thrown.
const appliedListeners = new Set();

export function onUndoRedoApplied(listener) {
  appliedListeners.add(listener);
  return () => appliedListeners.delete(listener);
}

async function notifyApplied(db, entry, direction) {
  for (const listener of appliedListeners) {
    try {
      await listener({ db, entry, direction });
    } catch (error) {
      console.warn("[undoManager] undo / redo listener failed", error);
    }
  }
}

export async function undo(options) {
  const entry = undoStack.pop();
  if (!entry) return;

  const db = options?.db ?? (await getDb());

  await withoutUndo(() => applyUndo(db, entry)).catch((error) => {
    undoStack.push(entry);
    throw error;
  });

  redoStack.push(entry);
  await withoutUndo(() => notifyApplied(db, entry, "undo"));
}

export async function redo(options) {
  const entry = redoStack.pop();
  if (!entry) return;

  const db = options?.db ?? (await getDb());

  await withoutUndo(() => applyRedo(db, entry)).catch((error) => {
    redoStack.push(entry);
    throw error;
  });

  undoStack.push(entry);
  await withoutUndo(() => notifyApplied(db, entry, "redo"));
}

// Chat undo already restored this batch; keep keyboard history navigable.
export function forgetAnnotationBatchUndo(jobId) {
  const isBatch = (entry) =>
    entry.type === "annotation_batch" && entry.key === jobId;
  // Also strip the batch from groups (older entries may have been folded in);
  // a group left empty is dropped.
  const strip = (stack) =>
    stack.flatMap((entry) => {
      if (isBatch(entry)) return [];
      if (entry.type !== "group") return [entry];
      const entries = entry.entries.filter((child) => !isBatch(child));
      if (entries.length === entry.entries.length) return [entry];
      return entries.length ? [{ ...entry, entries }] : [];
    });
  undoStack = strip(undoStack);
  redoStack = strip(redoStack);
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function clearUndo() {
  undoStack = [];
  redoStack = [];
}

export function getUndoStack() {
  return [...undoStack];
}

export function getRedoStack() {
  return [...redoStack];
}
