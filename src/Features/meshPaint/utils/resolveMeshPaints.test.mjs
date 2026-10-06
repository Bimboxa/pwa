import assert from "node:assert/strict";
import { test } from "node:test";

import {
  METRICS,
  storedEdge,
  storedFace,
  v,
} from "./meshPaintTestFixtures.mjs";
import resolveMeshPaints, {
  isMeshPaintCounted,
  isMeshPaintListed,
} from "./resolveMeshPaints.js";

const front = [v(0, 0, 0), v(4, 0, 0), v(4, 0, 2.5), v(0, 0, 2.5)];
const FRONT = storedFace(front, v(0, -1, 0));
const BACK = storedFace(front, v(0, 1, 0));

const templates = {
  tSurf: { id: "tSurf", listingId: "L1", drawingShape: "POLYGON" },
  tSurf2: { id: "tSurf2", listingId: "L1", type: "POLYGON" },
  tLine: { id: "tLine", listingId: "L1", drawingShape: "POLYLINE" },
  tGone: {
    id: "tGone",
    listingId: "L1",
    drawingShape: "POLYGON",
    deletedAt: "x",
  },
  tPoint: { id: "tPoint", listingId: "L1", type: "MARKER" },
};
const listings = {
  L1: { id: "L1" },
  Lgone: { id: "Lgone", deletedAt: "2026-01-01T00:00:00.000Z" },
};
const hosts = new Map([
  ["h1", { id: "h1", updatedAt: "2026-10-01T10:00:00.000Z" }],
  ["h2", { id: "h2", updatedAt: "2026-10-02T10:00:00.000Z" }],
  ["hGone", { id: "hGone", deletedAt: "2026-10-01T00:00:00.000Z" }],
]);

let seq = 0;
const row = (extra) => ({
  id: `r${++seq}`,
  partType: "FACE",
  baseMapId: "bm1",
  hostAnnotationId: "h1",
  annotationTemplateId: "tSurf",
  listingId: "L1",
  geometry: FRONT,
  paintedAt: "2026-10-01T12:00:00.000Z",
  sync: { state: "OK", geomHash: "x", syncedAt: "2026-10-01T12:00:00.000Z" },
  ...extra,
});

const resolve = (rows, metrics = { bm1: METRICS }) =>
  resolveMeshPaints({
    rows,
    hostById: hosts,
    templateById: templates,
    listingById: listings,
    metricsByBaseMapId: metrics,
  });

test("dropped rows are not listed at all", () => {
  const kept = row({ id: "kept" });
  const rows = [
    kept,
    row({ deletedAt: "2026-10-01T13:00:00.000Z" }),
    row({ annotationTemplateId: "missing" }),
    row({ annotationTemplateId: "tGone" }),
    row({ listingId: "Lgone" }),
    row({ listingId: "missing" }),
    row({ hostAnnotationId: "hGone" }),
    row({ hostAnnotationId: "missing" }),
    row({ annotationTemplateId: "tPoint" }),
    row({ sync: { state: "OK", provisional: true } }),
  ];
  const { items, byId } = resolve(rows);
  assert.deepEqual(
    items.map((item) => item.row.id),
    ["kept"]
  );
  assert.equal(byId.get("kept").template, templates.tSurf);
  assert.equal(byId.get("kept").host, hosts.get("h1"));
  assert.ok(isMeshPaintCounted(byId.get("kept")));
  assert.ok(isMeshPaintListed(byId.get("kept")));
});

test("a Ligne template keeps its painted facets (brush part mode)", () => {
  // A POLYLINE template paints edges by default, but the drawing helper can
  // switch the brush to facets: such a FACE row stays listed and counted.
  const faceByLine = row({ id: "faceByLine", annotationTemplateId: "tLine" });
  const { items, byId } = resolve([faceByLine]);
  assert.deepEqual(
    items.map((item) => item.row.id),
    ["faceByLine"]
  );
  assert.equal(byId.get("faceByLine").template, templates.tLine);
  assert.ok(isMeshPaintCounted(byId.get("faceByLine")));
});

test("orphans are listed, not counted", () => {
  const { items } = resolve([row({ sync: { state: "ORPHAN" } })]);
  assert.equal(items[0].status, "ORPHAN");
  assert.ok(!isMeshPaintCounted(items[0]));
  assert.ok(isMeshPaintListed(items[0]));
});

test("conflicts: newest paint wins, then smaller id; other side / edges untouched", () => {
  const old = row({
    id: "old",
    annotationTemplateId: "tSurf2",
    paintedAt: "2026-10-01T09:00:00.000Z",
  });
  const recent = row({
    id: "recent",
    hostAnnotationId: "h2",
    paintedAt: "2026-10-02T09:00:00.000Z",
  });
  const otherSide = row({ id: "back", geometry: BACK });
  const edgeLate = row({
    id: "edgeB",
    partType: "EDGE",
    annotationTemplateId: "tLine",
    geometry: storedEdge(v(0, 0, 2.5), v(4, 0, 2.5)),
    paintedAt: "2026-10-01T09:00:00.000Z",
  });
  const edgeEarly = { ...edgeLate, id: "edgeA" }; // same paintedAt → smaller id wins
  const orphan = row({ id: "orphan", sync: { state: "ORPHAN" } });
  const { byId } = resolve([
    old,
    recent,
    otherSide,
    edgeLate,
    edgeEarly,
    orphan,
  ]);
  assert.equal(byId.get("recent").status, "OK");
  assert.equal(byId.get("old").status, "CONFLICT");
  assert.equal(byId.get("back").status, "OK");
  assert.equal(byId.get("edgeA").status, "OK");
  assert.equal(byId.get("edgeB").status, "CONFLICT");
  assert.equal(byId.get("orphan").status, "ORPHAN");
  assert.ok(!isMeshPaintCounted(byId.get("old")));
  assert.ok(isMeshPaintListed(byId.get("old")));

  // createdAt stands in for a missing paintedAt.
  const a = row({
    id: "a",
    paintedAt: undefined,
    createdAt: "2026-10-03T00:00:00.000Z",
  });
  const b = row({ id: "b" });
  const second = resolve([b, a]).byId;
  assert.equal(second.get("a").status, "OK");
  assert.equal(second.get("b").status, "CONFLICT");

  // No metrics for the base map: no conflict detection.
  const noMetrics = resolve([old, recent], {}).byId;
  assert.equal(noMetrics.get("old").status, "OK");
  assert.equal(noMetrics.get("recent").status, "OK");
});

test("conflicts are scoped: a duplicated scope's coincident paint is no conflict", () => {
  const source = row({ id: "src", scopeId: "S1" });
  const copy = row({
    id: "dup",
    scopeId: "S2",
    hostAnnotationId: "h2",
    paintedAt: "2026-10-02T09:00:00.000Z",
  });
  const sameScope = row({
    id: "same",
    scopeId: "S1",
    hostAnnotationId: "h2",
    paintedAt: "2026-10-02T09:00:00.000Z",
  });
  const twoScopes = resolve([source, copy]).byId;
  assert.equal(twoScopes.get("src").status, "OK");
  assert.equal(twoScopes.get("dup").status, "OK");
  const oneScope = resolve([source, copy, sameScope]).byId;
  assert.equal(oneScope.get("same").status, "OK");
  assert.equal(oneScope.get("src").status, "CONFLICT");
  assert.equal(oneScope.get("dup").status, "OK");
});

test("isStale: host edited after the last sync", () => {
  const { byId } = resolve([
    row({ id: "fresh" }), // h1 updated 10:00, synced 12:00
    row({ id: "stale", hostAnnotationId: "h2" }), // h2 updated the next day
    row({
      id: "noSync",
      hostAnnotationId: "h2",
      sync: undefined,
      paintedAt: "2026-10-03T00:00:00.000Z",
    }),
  ]);
  assert.equal(byId.get("fresh").isStale, false);
  assert.equal(byId.get("stale").isStale, true);
  assert.equal(byId.get("noSync").isStale, false);
});
