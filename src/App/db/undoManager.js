const UNDO_TABLES = new Set([
  "annotations",
  "points",
  "portfolioBaseMapContainers",
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
  if (_group) {
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
      await db[entry.table].put(entry.before);
      break;
    case "delete":
      // Record was soft-deleted → restore it
      await db[entry.table].put(entry.before);
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
      await db[entry.table].put(entry.after);
      break;
    case "update":
      // Re-apply the modification
      await db[entry.table].put(entry.after);
      break;
    case "delete":
      // Re-apply the soft delete
      await db[entry.table].put(entry.after);
      break;
  }
}

export async function undo() {
  const entry = undoStack.pop();
  if (!entry) return;

  const db = await getDb();

  await withoutUndo(() => applyUndo(db, entry)).catch((error) => {
    undoStack.push(entry);
    throw error;
  });

  redoStack.push(entry);
}

export async function redo() {
  const entry = redoStack.pop();
  if (!entry) return;

  const db = await getDb();

  await withoutUndo(() => applyRedo(db, entry)).catch((error) => {
    redoStack.push(entry);
    throw error;
  });

  undoStack.push(entry);
}

// Chat undo already restored this batch; keep keyboard history navigable.
export function forgetAnnotationBatchUndo(jobId) {
  const keep = (entry) =>
    entry.type !== "annotation_batch" || entry.key !== jobId;
  undoStack = undoStack.filter(keep);
  redoStack = redoStack.filter(keep);
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
