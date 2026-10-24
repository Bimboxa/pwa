import test from "node:test";
import assert from "node:assert/strict";

import buildBusinessObjectsTree, {
  buildBusinessObjectsChildrenMap,
  getBusinessObjectAncestors,
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

// Scoped walk (Krnet TreeList scope): depth relative to the level, parent
// path between the level and the row.
test("scoped tree: relative depth and parentPath", () => {
  const objects = [
    { id: "ss", parentId: null, sortIndex: "a0", label: "Sous-sol" },
    { id: "asc", parentId: "ss", sortIndex: "a0", label: "Cage d’ascenseur" },
    { id: "park", parentId: "ss", sortIndex: "a1", label: "Parking" },
    { id: "za", parentId: "park", sortIndex: "a0", label: "Zone A" },
    { id: "zb", parentId: "park", sortIndex: "a1", label: "Zone B" },
    { id: "rdc", parentId: null, sortIndex: "a1", label: "RDC" },
  ];
  const scoped = buildBusinessObjectsTree(objects, { scopeId: "ss" });
  assert.deepEqual(
    scoped.map(({ businessObject, depth, parentPath }) => [
      businessObject.id,
      depth,
      parentPath,
    ]),
    [
      ["asc", 0, ""],
      ["park", 0, ""],
      ["za", 1, "Parking"],
      ["zb", 1, "Parking"],
    ]
  );
  // root walk: full paths
  const full = buildBusinessObjectsTree(objects);
  assert.equal(
    full.find((r) => r.businessObject.id === "za").parentPath,
    "Sous-sol / Parking"
  );
  assert.equal(full.length, 6);
});

test("unknown scope id falls back to the root", () => {
  const objects = [
    { id: "a", parentId: null, sortIndex: "a0", label: "A" },
    { id: "b", parentId: "a", sortIndex: "a0", label: "B" },
  ];
  const scoped = buildBusinessObjectsTree(objects, { scopeId: "ghost" });
  assert.deepEqual(
    scoped.map(({ businessObject, depth }) => [businessObject.id, depth]),
    [
      ["a", 0],
      ["b", 1],
    ]
  );
});

test("ancestors: root first, parent last; children map helper", () => {
  const objects = [
    { id: "a", parentId: null, sortIndex: "a1", label: "A" },
    { id: "b", parentId: "a", sortIndex: "a0", label: "B" },
    { id: "c", parentId: "b", sortIndex: "a0", label: "C" },
    { id: "d", parentId: null, sortIndex: "a0", label: "D" },
  ];
  assert.deepEqual(
    getBusinessObjectAncestors(objects, "c").map((o) => o.id),
    ["a", "b"]
  );
  assert.deepEqual(getBusinessObjectAncestors(objects, "d"), []);
  const map = buildBusinessObjectsChildrenMap(objects);
  assert.deepEqual(
    map.ROOT.map((o) => o.id),
    ["d", "a"]
  );
  assert.deepEqual(
    map.a.map((o) => o.id),
    ["b"]
  );
});
