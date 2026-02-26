const UNDO_TABLES = new Set([
  "annotations",
  "points",
  "portfolioBaseMapContainers",
]);
const MAX_UNDO = 50;

let undoStack = [];
let redoStack = [];
let _skipUndo = false;

export { UNDO_TABLES, _skipUndo };

export function withoutUndo(fn) {
  _skipUndo = true;
  return Promise.resolve(fn()).finally(() => {
    _skipUndo = false;
  });
}

export function pushUndo(entry) {
  if (_skipUndo) return;
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  // New action invalidates redo stack
  redoStack = [];
}

async function getDb() {
  const { default: db } = await import("./db");
  return db;
}

export async function undo() {
  const entry = undoStack.pop();
  if (!entry) return;

  const db = await getDb();

  await withoutUndo(async () => {
    switch (entry.type) {
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
  });

  redoStack.push(entry);
}

export async function redo() {
  const entry = redoStack.pop();
  if (!entry) return;

  const db = await getDb();

  await withoutUndo(async () => {
    switch (entry.type) {
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
  });

  undoStack.push(entry);
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
