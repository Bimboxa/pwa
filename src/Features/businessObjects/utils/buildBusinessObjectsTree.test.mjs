import test from "node:test";
import assert from "node:assert/strict";

import buildBusinessObjectsTree, {
  getBusinessObjectsTreeDisplayMeta,
} from "./buildBusinessObjectsTree.js";

// Numbering computed from the tree position — displayed as the code of the
// types with the autoNumbering feature (QUANTITY) and written by
// "Renuméroter" for the others.
test("tree numbering 1, 1.1, 1.2, 2 — title rows count", () => {
  const objects = [
    { id: "a", parentId: null, sortIndex: "a0", isTitle: true },
    { id: "a1", parentId: "a", sortIndex: "a0" },
    { id: "a2", parentId: "a", sortIndex: "a1" },
    { id: "a2x", parentId: "a2", sortIndex: "a0" },
    { id: "b", parentId: null, sortIndex: "a1" },
  ];
  const flatTree = buildBusinessObjectsTree(objects);
  assert.deepEqual(
    flatTree.map(({ businessObject }) => businessObject.id),
    ["a", "a1", "a2", "a2x", "b"]
  );
  const metas = getBusinessObjectsTreeDisplayMeta(flatTree);
  assert.deepEqual(
    metas.map((m) => m.number),
    ["1", "1.1", "1.2", "1.2.1", "2"]
  );
  assert.equal(metas[1].titleAncestors, 1);
  assert.equal(metas[3].objectAncestors, 1);
});
