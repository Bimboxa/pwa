import assert from "node:assert/strict";
import { test } from "node:test";

import resolvePaintedParts, {
  getPaintedPartHostLabelById,
} from "./resolvePaintedParts.js";
import aggregatePaintedPartsByTemplate from "./aggregatePaintedPartsByTemplate.js";

// 1000 × 600 px at 1 cm / px (non-square on purpose).
const metrics = { imageWidth: 1000, imageHeight: 600, meterByPx: 0.01 };
const metricsByBaseMapId = { bm1: metrics, bm2: metrics };

const P = (x, y, z = 0) => [
  (x / metrics.meterByPx + metrics.imageWidth / 2) / metrics.imageWidth,
  (-y / metrics.meterByPx + metrics.imageHeight / 2) / metrics.imageHeight,
  z,
];

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${expected}, got ${actual}`
  );

// Wall side 2 × 3 m in the plane y = yPlane, painted from -y.
const wallFace = (x0, yPlane = 1, w = 2, h = 3) => ({
  polygons: [
    {
      contour: [
        P(x0, yPlane, 0),
        P(x0 + w, yPlane, 0),
        P(x0 + w, yPlane, h),
        P(x0, yPlane, h),
      ],
      holes: [],
    },
  ],
  normal: [0, -1, 0],
});

const templates = {
  tplPlaster: {
    id: "tplPlaster",
    type: "POLYGON",
    drawingShape: "POLYGON",
    listingId: "Lfin",
    label: "Enduit",
  },
  tplCorner: {
    id: "tplCorner",
    type: "POLYLINE",
    drawingShape: "POLYLINE",
    listingId: "Lfin",
    label: "Cornière",
  },
  tplPaint: {
    id: "tplPaint",
    type: "POLYGON",
    drawingShape: "POLYGON",
    listingId: "Lfin",
    label: "Peinture",
  },
  // host template, eye OFF
  tplWall: {
    id: "tplWall",
    type: "POLYLINE",
    listingId: "Lstruct",
    label: "Voile",
    hidden: true,
  },
};

const listings = {
  Lfin: { id: "Lfin", scopeId: "S1", name: "Finitions" },
  Lstruct: { id: "Lstruct", scopeId: "S1", name: "Structure" },
};

const hosts = {
  h1: {
    id: "h1",
    annotationTemplateId: "tplWall",
    listingId: "Lstruct",
    baseMapId: "bm1",
    layerId: "lay1",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  h2: {
    id: "h2",
    annotationTemplateId: "tplWall",
    listingId: "Lstruct",
    baseMapId: "bm1",
    layerId: "lay2",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  h3: {
    id: "h3",
    annotationTemplateId: "tplWall",
    listingId: "Lstruct",
    baseMapId: "bm2",
    updatedAt: "2026-01-01T00:00:00.000Z",
    label: "Voile nord",
  },
};

const row = (id, extra) => ({
  id,
  projectId: "p1",
  scopeId: "S1",
  listingId: "Lfin",
  baseMapId: "bm1",
  createdAt: "2026-02-01T00:00:00.000Z",
  paintedAt: "2026-02-01T00:00:00.000Z",
  sync: {
    state: "OK",
    geomHash: null,
    syncedAt: "2026-02-01T00:00:00.000Z",
  },
  ...extra,
});

const rows = [
  // 6 m² face on h1 (layer lay1)
  row("r1", {
    annotationTemplateId: "tplPlaster",
    hostAnnotationId: "h1",
    partType: "FACE",
    geometry: wallFace(0),
  }),
  // 5 m edge on h2 (layer lay2)
  row("r2", {
    annotationTemplateId: "tplCorner",
    hostAnnotationId: "h2",
    partType: "EDGE",
    geometry: { points: [P(1, 1, 0), P(4, 5, 0)] },
  }),
  // orphan face on h1 (elsewhere)
  row("r3", {
    annotationTemplateId: "tplPlaster",
    hostAnnotationId: "h1",
    partType: "FACE",
    geometry: wallFace(-4),
    sync: {
      state: "ORPHAN",
      geomHash: null,
      syncedAt: "2026-02-01T00:00:00.000Z",
    },
  }),
  // 6 m² face on h3 (other base map, host without layer)
  row("r4", {
    annotationTemplateId: "tplPlaster",
    hostAnnotationId: "h3",
    baseMapId: "bm2",
    partType: "FACE",
    geometry: wallFace(2, -2),
  }),
];

const resolve = (filters, extra = {}) =>
  resolvePaintedParts({
    rows,
    hostById: hosts,
    templateById: templates,
    listingById: listings,
    metricsByBaseMapId,
    baseMapById: { bm1: { name: "RDC" }, bm2: { name: "R+1" } },
    filters,
    ...extra,
  });

const ids = (parts) => parts.map((p) => p.id).sort();

test("host template hidden + host listing excluded: own template visible → kept and counted", () => {
  const parts = resolve({
    keepHiddenTemplates: false,
    excludeListingsIds: ["Lstruct"],
  });
  assert.deepEqual(ids(parts), ["r1", "r2", "r3", "r4"]);
  const r1 = parts.find((p) => p.id === "r1");
  assert.equal(r1.isCounted, true);
  near(r1.surface, 6);
  assert.equal(r1.listingName, "Finitions");
  assert.equal(r1.baseMapName, "RDC");
  assert.equal(r1.layerId, "lay1");
  assert.deepEqual(r1.normal, { x: 0, y: -1, z: 0 });
  const r2 = parts.find((p) => p.id === "r2");
  near(r2.length, 5);
  assert.equal(r2.normal, null);
});

test("own template hidden → dropped unless keepHiddenTemplates", () => {
  const hiddenOwn = {
    ...templates,
    tplPlaster: { ...templates.tplPlaster, hidden: true },
  };
  assert.deepEqual(
    ids(resolve({ keepHiddenTemplates: false }, { templateById: hiddenOwn })),
    ["r2"]
  );
  const kept = resolve(
    { keepHiddenTemplates: true },
    { templateById: hiddenOwn }
  );
  assert.deepEqual(ids(kept), ["r1", "r2", "r3", "r4"]);
  assert.equal(kept.find((p) => p.id === "r1").hidden, true);
});

test("own listing excluded / own template disabled / profile → dropped", () => {
  assert.deepEqual(ids(resolve({ excludeListingsIds: ["Lfin"] })), []);
  assert.deepEqual(
    ids(resolve({ disabledAnnotationTemplates: ["tplCorner"] })),
    ["r1", "r3", "r4"]
  );
  const profile = {
    ...templates,
    tplCorner: { ...templates.tplCorner, isProfile: true },
  };
  assert.deepEqual(
    ids(resolve({ excludeProfileTemplates: true }, { templateById: profile })),
    ["r1", "r3", "r4"]
  );
});

test("hidden HOST layer hides its painted parts", () => {
  assert.deepEqual(ids(resolve({ hiddenLayerIds: ["lay1"] })), ["r2", "r4"]);
  // host without layer
  assert.deepEqual(ids(resolve({ showAnnotationsWithoutLayer: false })), [
    "r1",
    "r2",
    "r3",
  ]);
  assert.deepEqual(ids(resolve({ disabledLayerIds: ["__no_layer__"] })), [
    "r1",
    "r2",
    "r3",
  ]);
  assert.deepEqual(ids(resolve({ disabledLayerIds: ["lay2"] })), [
    "r1",
    "r3",
    "r4",
  ]);
});

test("orphan: listed, not counted", () => {
  const parts = resolve({});
  const r3 = parts.find((p) => p.id === "r3");
  assert.equal(r3.isOrphan, true);
  assert.equal(r3.isCounted, false);
  near(r3.surface, 6); // displayed struck through

  const { byTemplateId, countsByListingId, templateIds, listingIds } =
    aggregatePaintedPartsByTemplate(parts);
  const plaster = byTemplateId.tplPlaster;
  near(plaster.surface, 12); // r1 + r4, not r3
  assert.equal(plaster.partsCount, 2);
  assert.equal(plaster.facesCount, 2);
  assert.equal(plaster.orphansCount, 1);
  assert.equal(plaster.listedCount, 3);
  near(byTemplateId.tplCorner.length, 5);
  assert.equal(byTemplateId.tplCorner.edgesCount, 1);
  assert.deepEqual(countsByListingId, { Lfin: 3 });
  assert.deepEqual([...templateIds].sort(), ["tplCorner", "tplPlaster"]);
  assert.deepEqual([...listingIds], ["Lfin"]);
});

test("scope: OWN listing of the scope, or linked into it", () => {
  // the paint's own listing belongs to S2 (the host's listing stays in S1)
  const otherScope = {
    ...listings,
    Lfin: { ...listings.Lfin, scopeId: "S2" },
  };
  assert.deepEqual(
    ids(resolve({ scopeId: "S1" }, { listingById: otherScope })),
    []
  );
  assert.deepEqual(
    ids(
      resolve(
        { scopeId: "S1", linkedListingIds: ["Lfin"] },
        { listingById: otherScope }
      )
    ),
    ["r1", "r2", "r3", "r4"]
  );
  assert.deepEqual(ids(resolve({ scopeId: "S1" })), ["r1", "r2", "r3", "r4"]);
  // listing without scopeId: the scope the part was painted in
  const noScope = { ...listings, Lfin: { id: "Lfin", name: "Finitions" } };
  const mixed = rows.map((r) => (r.id === "r2" ? { ...r, scopeId: "S2" } : r));
  assert.deepEqual(
    ids(resolve({ scopeId: "S1" }, { listingById: noScope, rows: mixed })),
    ["r1", "r3", "r4"]
  );
});

test("base maps, POV freeze, base map annotation hosts", () => {
  assert.deepEqual(ids(resolve({ baseMapIds: ["bm2"] })), ["r4"]);
  assert.deepEqual(ids(resolve({ baseMapIds: new Set(["bm1", "bm2"]) })), [
    "r1",
    "r2",
    "r3",
    "r4",
  ]);
  assert.deepEqual(ids(resolve({ excludeBaseMapIds: ["bm1"] })), ["r4"]);

  const freeze = { povFreezeCreatedBefore: "2026-02-15T00:00:00.000Z" };
  const late = rows.map((r) =>
    r.id === "r4" ? { ...r, createdAt: "2026-03-01T00:00:00.000Z" } : r
  );
  assert.deepEqual(ids(resolve(freeze, { rows: late })), ["r1", "r2", "r3"]);
  const lateHost = {
    ...hosts,
    h2: { ...hosts.h2, createdAt: "2026-03-01T00:00:00.000Z" },
  };
  assert.deepEqual(ids(resolve(freeze, { hostById: lateHost })), [
    "r1",
    "r3",
    "r4",
  ]);

  const baseMapHost = {
    ...hosts,
    h3: { ...hosts.h3, isBaseMapAnnotation: true },
  };
  assert.deepEqual(ids(resolve({}, { hostById: baseMapHost })), [
    "r1",
    "r2",
    "r3",
  ]);
});

test("isForBaseMaps partition on the OWN listing", () => {
  const forBaseMaps = {
    ...listings,
    Lfin: { ...listings.Lfin, isForBaseMaps: true },
  };
  assert.deepEqual(
    ids(
      resolve(
        { excludeIsForBaseMapsListings: true },
        { listingById: forBaseMaps }
      )
    ),
    []
  );
  assert.deepEqual(ids(resolve({ onlyIsForBaseMapsListings: true })), []);
});

test("view box in reference image pixels (unknown metrics → kept)", () => {
  // r1: x 0..2 m → px 500..700, y = 1 m → py 200; r2: (1,1)→(4,5) m →
  // px 600..900, py -200..200; r3: x -4..-2 m → px 100..300.
  const box = { x: 450, y: 150, width: 100, height: 100 };
  assert.deepEqual(ids(resolve({ viewBox: box, baseMapIds: ["bm1"] })), ["r1"]);
  const wider = { x: 450, y: 150, width: 200, height: 100 };
  assert.deepEqual(ids(resolve({ viewBox: wider, baseMapIds: ["bm1"] })), [
    "r1",
    "r2",
  ]);
  const noMetrics = resolve(
    { viewBox: { x: -10, y: -10, width: 1, height: 1 } },
    { metricsByBaseMapId: { bm1: metrics } }
  );
  assert.deepEqual(ids(noMetrics), ["r4"]);
  assert.equal(noMetrics[0].qtiesEnabled, false);
});

test("stale: host changed after the last sync", () => {
  const touched = {
    ...hosts,
    h1: { ...hosts.h1, updatedAt: "2026-02-10T00:00:00.000Z" },
  };
  const parts = resolve({}, { hostById: touched });
  assert.equal(parts.find((p) => p.id === "r1").isStale, true);
  assert.equal(parts.find((p) => p.id === "r2").isStale, false);
});

test("conflict: same face side painted twice → older one listed, not counted", () => {
  const twice = [
    ...rows,
    row("r5", {
      annotationTemplateId: "tplPaint",
      hostAnnotationId: "h2",
      partType: "FACE",
      geometry: wallFace(0),
      paintedAt: "2026-02-05T00:00:00.000Z",
    }),
  ];
  const parts = resolve({}, { rows: twice });
  assert.equal(parts.find((p) => p.id === "r1").isConflict, true);
  assert.equal(parts.find((p) => p.id === "r1").isCounted, false);
  assert.equal(parts.find((p) => p.id === "r5").isCounted, true);
  const { byTemplateId } = aggregatePaintedPartsByTemplate(parts);
  near(byTemplateId.tplPlaster.surface, 6); // r4 only
  assert.equal(byTemplateId.tplPlaster.conflictsCount, 1);
  near(byTemplateId.tplPaint.surface, 6);
});

test("dropped upstream: deleted host, deleted template, provisional copy", () => {
  const deletedHost = { ...hosts, h2: { ...hosts.h2, deletedAt: "x" } };
  assert.deepEqual(ids(resolve({}, { hostById: deletedHost })), [
    "r1",
    "r3",
    "r4",
  ]);
  const provisional = rows.map((r) =>
    r.id === "r1" ? { ...r, sync: { ...r.sync, provisional: true } } : r
  );
  assert.deepEqual(ids(resolve({}, { rows: provisional })), ["r2", "r3", "r4"]);
});

test("host labels: own label, else '<template> NN' in draw order", () => {
  const parts = resolve({});
  const annotations = [
    { id: "h2", annotationTemplateId: "tplWall", createdAt: "2026-01-02" },
    { id: "hx", annotationTemplateId: "tplWall", createdAt: "2026-01-03" },
    { id: "h1", annotationTemplateId: "tplWall", createdAt: "2026-01-01" },
  ];
  const labels = getPaintedPartHostLabelById({
    parts,
    annotations,
    templateById: templates,
  });
  assert.deepEqual(labels, {
    h1: "Voile 01",
    h2: "Voile 02",
    h3: "Voile nord", // not listed by the panel: raw host label
  });
});
