import assert from "node:assert/strict";
import { test } from "node:test";

import getMeshPaintVisibility, {
  MESH_PAINT_VISIBILITY,
} from "./getMeshPaintVisibility.js";

const { HIDDEN, DIMMED, VISIBLE } = MESH_PAINT_VISIBILITY;

// A FACE painted by template "tP" (listing "lP") on host "h1" (whose own
// template "tH" / listing "lH" must never matter), on the main base map.
function makeItem(overrides = {}) {
  return {
    row: {
      id: "p1",
      listingId: "lP",
      annotationTemplateId: "tP",
      hostAnnotationId: "h1",
      baseMapId: "bmMain",
      partType: "FACE",
      createdAt: "2026-10-01T10:00:00.000Z",
      sync: { state: "OK" },
      ...overrides.row,
    },
    status: overrides.status ?? "OK",
    host: {
      id: "h1",
      listingId: "lH",
      annotationTemplateId: "tH",
      baseMapId: "bmMain",
      layerId: "layer1",
      createdAt: "2026-09-01T10:00:00.000Z",
      ...overrides.host,
    },
    template: { id: "tP", type: "POLYGON", ...overrides.template },
  };
}

function makeCtx(overrides = {}) {
  return {
    mainBaseMapId: "bmMain",
    baseMapModeById: { bmExtra: "NORMAL", bmDim: "DIMMED" },
    hiddenTemplateIds: new Set(),
    hiddenListingIds: new Set(),
    listingById: {
      lP: { id: "lP", scopeId: "s1" },
      lH: { id: "lH", scopeId: "s1" },
    },
    scopeId: "s1",
    linkedListingIds: new Set(),
    hiddenLayerIds: new Set(),
    showAnnotationsWithoutLayer: true,
    ...overrides,
  };
}

test("a plain paint on the main base map is visible", () => {
  assert.equal(getMeshPaintVisibility(makeItem(), makeCtx()), VISIBLE);
});

test("the host's template and listing are never read", () => {
  const ctx = makeCtx({
    hiddenTemplateIds: new Set(["tH"]),
    hiddenListingIds: new Set(["lH"]),
    soloAnnotationTemplateId: "tP",
  });
  assert.equal(getMeshPaintVisibility(makeItem(), ctx), VISIBLE);
});

test("own template hidden (set or template flag) → hidden", () => {
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ hiddenTemplateIds: new Set(["tP"]) })
    ),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(makeItem({ template: { hidden: true } }), makeCtx()),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(makeItem(), makeCtx({ hiddenTemplateIds: ["tP"] })),
    HIDDEN,
    "arrays are accepted too"
  );
});

test("own listing hidden → hidden", () => {
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ hiddenListingIds: new Set(["lP"]) })
    ),
    HIDDEN
  );
});

test("profile templates are excluded from 3D (opt-out)", () => {
  const item = makeItem({ template: { isProfile: true } });
  assert.equal(getMeshPaintVisibility(item, makeCtx()), HIDDEN);
  assert.equal(
    getMeshPaintVisibility(item, makeCtx({ excludeProfileTemplates: false })),
    VISIBLE
  );
});

test("isForBaseMaps partition of the OWN listing", () => {
  const forBaseMaps = makeCtx({
    listingById: { lP: { id: "lP", scopeId: "s1", isForBaseMaps: true } },
  });
  assert.equal(getMeshPaintVisibility(makeItem(), forBaseMaps), HIDDEN);
  assert.equal(
    getMeshPaintVisibility(makeItem(), {
      ...forBaseMaps,
      isBaseMapsModule: true,
    }),
    VISIBLE
  );
  // Base maps module: drawing listings only when "Afficher les annotations".
  assert.equal(
    getMeshPaintVisibility(makeItem(), makeCtx({ isBaseMapsModule: true })),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ isBaseMapsModule: true, showAnnotationsInBaseMaps: true })
    ),
    VISIBLE
  );
});

test("scope: own listing of another scope hidden, linked listing kept", () => {
  const ctx = makeCtx({ listingById: { lP: { id: "lP", scopeId: "s2" } } });
  assert.equal(getMeshPaintVisibility(makeItem(), ctx), HIDDEN);
  assert.equal(
    getMeshPaintVisibility(makeItem(), {
      ...ctx,
      linkedListingIds: new Set(["lP"]),
    }),
    VISIBLE
  );
  assert.equal(
    getMeshPaintVisibility(makeItem(), { ...ctx, scopeId: null }),
    VISIBLE,
    "no selected scope → no scope filter"
  );
});

test("base maps: main / extra NORMAL / extra DIMMED / not loaded", () => {
  const ctx = makeCtx();
  assert.equal(
    getMeshPaintVisibility(makeItem({ row: { baseMapId: "bmExtra" } }), ctx),
    VISIBLE
  );
  assert.equal(
    getMeshPaintVisibility(makeItem({ row: { baseMapId: "bmDim" } }), ctx),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(makeItem({ row: { baseMapId: "bmOther" } }), ctx),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem({ row: { baseMapId: "bmOther" } }),
      makeCtx({ baseMapModeById: { bmOther: "NONE" } })
    ),
    HIDDEN
  );
});

test("hide toggles: main annotations / all annotations", () => {
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ hideMainBaseMapAnnotationsIn3d: true })
    ),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem({ row: { baseMapId: "bmExtra" } }),
      makeCtx({ hideMainBaseMapAnnotationsIn3d: true })
    ),
    VISIBLE,
    "only the main base map is concerned"
  );
  assert.equal(
    getMeshPaintVisibility(makeItem(), makeCtx({ hideAnnotationsIn3d: true })),
    HIDDEN
  );
});

test("the host's layer is followed", () => {
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ hiddenLayerIds: new Set(["layer1"]) })
    ),
    HIDDEN
  );
  const noLayer = makeItem({ host: { layerId: null } });
  assert.equal(getMeshPaintVisibility(noLayer, makeCtx()), VISIBLE);
  assert.equal(
    getMeshPaintVisibility(
      noLayer,
      makeCtx({ showAnnotationsWithoutLayer: false })
    ),
    HIDDEN
  );
});

test("missing / deleted host or row → hidden", () => {
  const item = makeItem();
  assert.equal(
    getMeshPaintVisibility({ ...item, host: undefined }, makeCtx()),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem({ host: { deletedAt: "2026-10-02T00:00:00.000Z" } }),
      makeCtx()
    ),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem({ row: { deletedAt: "2026-10-02T00:00:00.000Z" } }),
      makeCtx()
    ),
    HIDDEN
  );
});

test("mesh cells: a parent replaced by its cells hides its paints", () => {
  const ctx = makeCtx({
    showMeshCells: true,
    meshCellParentIds: new Set(["h1"]),
  });
  assert.equal(getMeshPaintVisibility(makeItem(), ctx), HIDDEN);
  assert.equal(
    getMeshPaintVisibility(makeItem(), { ...ctx, showMeshCells: false }),
    VISIBLE
  );
});

test("POV freeze: paints (or hosts) created later are hidden", () => {
  const ctx = makeCtx({ povFreezeCreatedBefore: "2026-09-15T00:00:00.000Z" });
  assert.equal(getMeshPaintVisibility(makeItem(), ctx), HIDDEN);
  const older = makeItem({ row: { createdAt: "2026-09-10T00:00:00.000Z" } });
  assert.equal(getMeshPaintVisibility(older, ctx), VISIBLE);
  const laterHost = makeItem({
    row: { createdAt: "2026-09-10T00:00:00.000Z" },
    host: { createdAt: "2026-09-20T00:00:00.000Z" },
  });
  assert.equal(getMeshPaintVisibility(laterHost, ctx), HIDDEN);
});

test("status: CONFLICT hidden, ORPHAN dimmed", () => {
  assert.equal(
    getMeshPaintVisibility(makeItem({ status: "CONFLICT" }), makeCtx()),
    HIDDEN
  );
  assert.equal(
    getMeshPaintVisibility(makeItem({ status: "ORPHAN" }), makeCtx()),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem({ row: { sync: { state: "ORPHAN" } } }),
      makeCtx()
    ),
    DIMMED
  );
});

test("HIDDEN wins over DIMMED", () => {
  assert.equal(
    getMeshPaintVisibility(
      makeItem({ status: "ORPHAN", row: { baseMapId: "bmDim" } }),
      makeCtx({ hiddenListingIds: ["lP"] })
    ),
    HIDDEN
  );
});

test("solos dim what they leave out", () => {
  // template solo: the paint's own template
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ soloAnnotationTemplateId: "tOther" })
    ),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ soloAnnotationTemplateId: "tP" })
    ),
    VISIBLE
  );
  // annotation solo: the host
  assert.equal(
    getMeshPaintVisibility(makeItem(), makeCtx({ soloAnnotationId: "h2" })),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(makeItem(), makeCtx({ soloAnnotationId: "h1" })),
    VISIBLE
  );
  // zone solo: zone template or host linked to the zone
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ soloZone: { templateId: "tZ" }, zoneSoloAnnotationIds: [] })
    ),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({
        soloZone: { templateId: "tZ" },
        zoneSoloAnnotationIds: new Set(["h1"]),
      })
    ),
    VISIBLE
  );
  // work package / business object solos: host linked
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ soloWorkPackageId: "wp", workPackageSoloAnnotationIds: [] })
    ),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({
        soloBusinessObjectId: "bo",
        businessObjectSoloAnnotationIds: new Set(["h1"]),
      })
    ),
    VISIBLE
  );
});

test("revolution axis solo follows the HOST's axis", () => {
  const revolved = makeItem({
    host: { shape3D: { key: "REVOLUTION", axisAnnotationId: "axis1" } },
  });
  // solo: dims everything that is not built on the soloed axis
  assert.equal(
    getMeshPaintVisibility(
      revolved,
      makeCtx({ soloRevolutionAxisId: "axis1" })
    ),
    VISIBLE
  );
  assert.equal(
    getMeshPaintVisibility(
      revolved,
      makeCtx({ soloRevolutionAxisId: "axis2" })
    ),
    DIMMED
  );
  assert.equal(
    getMeshPaintVisibility(
      makeItem(),
      makeCtx({ soloRevolutionAxisId: "axis1" })
    ),
    DIMMED
  );
});
