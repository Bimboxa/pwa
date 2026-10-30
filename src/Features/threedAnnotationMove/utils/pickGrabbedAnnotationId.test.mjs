import assert from "node:assert/strict";
import { test } from "node:test";

import pickGrabbedAnnotationId from "./pickGrabbedAnnotationId.js";

const blue = { id: "blue", type: "POLYGON" };
const yellow = { id: "yellow", type: "POLYGON" };
const cote = { id: "cote", type: "COTE" };
const annotations = [blue, yellow, cote];
const select = (...ids) =>
  ids.map((id) => ({ type: "NODE", nodeType: "ANNOTATION", nodeId: id }));

test("no selection: the snapped annotation is grabbed", () => {
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: "yellow",
      selectedItems: [],
      annotations,
    }),
    "yellow"
  );
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: null,
      selectedItems: [],
      annotations,
    }),
    null
  );
});

test("snapped annotation inside the selection: it is the grabbed one", () => {
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: "yellow",
      selectedItems: select("blue", "yellow"),
      annotations,
    }),
    "yellow"
  );
});

test("shared vertex: the selection wins over the snapped vertex's owner", () => {
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: "yellow",
      selectedItems: select("blue"),
      annotations,
    }),
    "blue"
  );
  // Free pivot (no snapped annotation) with a selection: first selected.
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: null,
      selectedItems: select("blue"),
      annotations,
    }),
    "blue"
  );
});

test("selection without a carriable annotation: back to the snapped one", () => {
  // COTE is not point-based for the 3D tools; a footprint is never carried.
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: "yellow",
      selectedItems: select("cote", "foreign::blue"),
      annotations,
    }),
    "yellow"
  );
  // The 2D tools widen the filter: COTE becomes carriable.
  assert.equal(
    pickGrabbedAnnotationId({
      snapAnnotationId: "yellow",
      selectedItems: select("cote"),
      annotations,
      isCarriableType: (t) => ["POLYGON", "COTE"].includes(t),
    }),
    "cote"
  );
});
