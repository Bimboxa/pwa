import assert from "node:assert/strict";
import { test } from "node:test";

import planRestoredMeshPaintsSync, {
  getRestoredMeshPaintsHostIds,
  getRestoredMeshPaintsPointIds,
} from "./planRestoredMeshPaintsSync.js";

const T = (minute) =>
  `2026-10-01T00:${String(minute).padStart(2, "0")}:00.000Z`;

const host = (updatedAt, extra = {}) => ({
  id: "H",
  updatedAt,
  points: [{ id: "p1" }, { id: "p2" }],
  ...extra,
});
const paint = (syncedAt, extra = {}) => ({
  id: "M",
  hostAnnotationId: "H",
  sync: { state: "OK", syncedAt },
  ...extra,
});

test("a paint moved with its host (one group): in sync → refreshed", () => {
  // 2D move at T(10): points moved, paint moved (synced at 10).
  const entry = {
    type: "group",
    entries: [
      {
        table: "points",
        type: "update",
        key: "p1",
        before: { id: "p1", updatedAt: T(1) },
        after: { id: "p1", updatedAt: T(10) },
      },
      {
        table: "meshPaints",
        type: "update",
        key: "M",
        before: paint(T(2)),
        after: paint(T(10)),
      },
    ],
  };
  const inputs = {
    hostById: { H: host(T(0)) },
    pointById: { p1: { updatedAt: T(30) }, p2: { updatedAt: T(1) } },
  };
  assert.deepEqual(
    planRestoredMeshPaintsSync({ entry, direction: "undo", ...inputs }),
    ["M"]
  );
  assert.deepEqual(
    planRestoredMeshPaintsSync({ entry, direction: "redo", ...inputs }),
    ["M"]
  );
  assert.deepEqual(getRestoredMeshPaintsHostIds({ entry, direction: "undo" }), [
    "H",
  ]);
});

test("a paint already stale at the snapshot stays stale", () => {
  const entry = {
    type: "group",
    entries: [
      {
        table: "annotations",
        type: "update",
        key: "H",
        before: host(T(5)),
        after: host(T(10)),
      },
      {
        table: "meshPaints",
        type: "update",
        key: "M",
        before: paint(T(2)), // host edited at 5 after the sync at 2
        after: paint(T(2)),
      },
    ],
  };
  assert.deepEqual(
    planRestoredMeshPaintsSync({
      entry,
      direction: "undo",
      hostById: {},
      pointById: {},
    }),
    []
  );
});

test("paint-only entries (toggle) and deleted paints: nothing to refresh", () => {
  const toggle = {
    table: "meshPaints",
    type: "update",
    key: "M",
    before: paint(T(2)),
    after: paint(T(3)),
  };
  assert.deepEqual(
    planRestoredMeshPaintsSync({
      entry: toggle,
      direction: "undo",
      hostById: { H: host(T(0)) },
      pointById: {},
    }),
    []
  );
  const cascade = {
    type: "group",
    entries: [
      {
        table: "annotations",
        type: "delete",
        key: "H",
        before: host(T(1)),
        after: host(T(9), { deletedAt: T(9) }),
      },
      {
        table: "meshPaints",
        type: "delete",
        key: "M",
        before: paint(T(2)),
        after: paint(T(2), { deletedAt: T(9) }),
      },
    ],
  };
  const inputs = { hostById: {}, pointById: {} };
  assert.deepEqual(
    planRestoredMeshPaintsSync({
      entry: cascade,
      direction: "undo",
      ...inputs,
    }),
    ["M"]
  );
  assert.deepEqual(
    planRestoredMeshPaintsSync({
      entry: cascade,
      direction: "redo",
      ...inputs,
    }),
    []
  );
  assert.deepEqual(
    getRestoredMeshPaintsPointIds({
      entry: cascade,
      direction: "undo",
      hosts: [],
    }),
    ["p1", "p2"]
  );
});
