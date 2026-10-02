import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearUndo,
  getUndoStack,
  pushUndo,
  withUndoGroup,
} from "./undoManager.js";

const entry = (key) => ({ table: "points", type: "create", key });

test("writes of an undo group are one undo step", async () => {
  clearUndo();
  await withUndoGroup(async () => {
    pushUndo(entry("a"));
    await withUndoGroup(async () => pushUndo(entry("b")));
    pushUndo(entry("c"));
  });
  const stack = getUndoStack();
  assert.equal(stack.length, 1);
  assert.equal(stack[0].type, "group");
  assert.deepEqual(
    stack[0].entries.map((e) => e.key),
    ["a", "b", "c"]
  );

  // A single write stays a plain entry; an empty group pushes nothing.
  await withUndoGroup(async () => pushUndo(entry("d")));
  await withUndoGroup(async () => {});
  assert.equal(getUndoStack().length, 2);
  assert.equal(getUndoStack()[1].key, "d");

  // The group closes even when its writes throw.
  await assert.rejects(
    withUndoGroup(async () => {
      pushUndo(entry("e"));
      throw new Error("boom");
    })
  );
  pushUndo(entry("f"));
  assert.deepEqual(
    getUndoStack().slice(2).map((e) => e.key),
    ["e", "f"]
  );
});
