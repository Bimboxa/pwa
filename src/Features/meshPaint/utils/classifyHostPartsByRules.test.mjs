import assert from "node:assert/strict";
import { test } from "node:test";

import buildHostPartIndex from "./buildHostPartIndex.js";
import classifyHostPartsByRules, {
  DEFAULT_QTES_THRESHOLDS,
} from "./classifyHostPartsByRules.js";
import weldSupportFootprints from "./weldSupportFootprints.js";
import findReentrantChains from "./findReentrantChains.js";
import findBaseEdgesOnSupports from "./findBaseEdgesOnSupports.js";
import meterHostParts from "./meterHostParts.js";
import { boxTriangles, quadTriangles, v } from "./meshPaintTestFixtures.mjs";

// Role rules of the pool metering (mirror of piscineQtesParams.POOL_ROLE_RULES)
const RULES = {
  SHELL: {
    orient: "INTERIOR",
    nonVertical: "sol",
    vertical: "parois",
    ignore: { levelZero: true },
    weld: ["SUPPORT"],
    angles: "INTRA",
  },
  PIT: {
    orient: "INTERIOR",
    nonVertical: "sol",
    vertical: "parois",
    ignore: { top: true },
    weld: ["FOOTPRINT"],
    angles: null,
  },
  WALL: {
    orient: "EXTERIOR",
    top: "antiderapant",
    vertical: "parois",
    ignore: { bottom: true },
    weld: ["FOOTPRINT", "SUPPORT"],
    angles: "BASE",
  },
  PODIUM: {
    orient: "EXTERIOR",
    top: "antiderapant",
    slopedTop: "antiderapant",
    vertical: "parois",
    weld: ["FOOTPRINT"],
    angles: "BASE",
  },
  DECK: {
    orient: "UP",
    top: "antiderapant",
    levelOnly: true,
    weld: ["SUPPORT"],
    angles: null,
  },
};

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const sum = (values) => values.reduce((s, x) => s + x, 0);

// --- fixtures -------------------------------------------------------------

// Pool shell = water prism (x along, y across, z up), OPEN at z = 0:
// shallow flat La at −P1, slope, deep flat Lb at −P2, end walls, two caps.
const L = 10;
const l = 4;
const La = 3;
const Lb = 3;
const P1 = 1;
const P2 = 2;
const SECTION = [
  v(0, 0, 0),
  v(0, 0, -P1),
  v(La, 0, -P1),
  v(L - Lb, 0, -P2),
  v(L, 0, -P2),
  v(L, 0, 0),
];
function shellTriangles() {
  const out = [];
  const far = (p) => v(p.x, l, p.z);
  // walls / floors between the section at y = 0 and y = l (top edge
  // segment F → A left out: the shell is open at the water plane)
  for (let i = 0; i + 1 < SECTION.length; i++) {
    quadTriangles(
      SECTION[i],
      SECTION[i + 1],
      far(SECTION[i + 1]),
      far(SECTION[i]),
      out
    );
  }
  // caps: fan from the deep-end top corner (star-shaped from there)
  const apex = SECTION[5];
  for (let i = 0; i + 1 < 5; i++) {
    const a = SECTION[i];
    const b = SECTION[i + 1];
    out.push(apex.x, apex.y, apex.z, a.x, a.y, a.z, b.x, b.y, b.z);
    const A = far(apex);
    const fa = far(a);
    const fb = far(b);
    out.push(A.x, A.y, A.z, fb.x, fb.y, fb.z, fa.x, fa.y, fa.z);
  }
  return out;
}

const hostOf = (hostId, role, triangles) => {
  const index = buildHostPartIndex({ triangles: Float64Array.from(triangles) });
  return {
    hostId,
    role,
    islands: index.islands,
    chains: index.chains,
    box: index.box,
  };
};

const byCategory = (faces, category) =>
  faces.filter((f) => f.category === category);
const slopeLength = Math.hypot(L - La - Lb, P2 - P1);

// --- (a) shell alone -------------------------------------------------------

test("water prism: floors (flats + slope) and walls, normals toward the water", () => {
  const shell = hostOf("shell", "SHELL", shellTriangles());
  const { faces, hosts } = classifyHostPartsByRules({
    hosts: [shell],
    rules: RULES,
  });
  const sol = byCategory(faces, "sol");
  const parois = byCategory(faces, "parois");
  assert.equal(sol.length, 3);
  assert.equal(parois.length, 4); // 2 end walls + 2 caps
  assert.ok(
    near(sum(sol.map((f) => f.area)), La * l + Lb * l + slopeLength * l, 1e-6)
  );
  assert.ok(
    near(
      sum(parois.map((f) => f.area)),
      P1 * l +
        P2 * l +
        2 * (La * P1 + Lb * P2 + ((L - La - Lb) * (P1 + P2)) / 2),
      1e-6
    )
  );
  // floors point up (into the water), walls point inward
  assert.ok(sol.every((f) => f.normal.z > 0.5));
  const [oriented] = hosts;
  for (const face of parois) {
    const inward = face.polygons[0].contour[0];
    const centre = { x: L / 2, y: l / 2 };
    const toCentre = { x: centre.x - inward.x, y: centre.y - inward.y };
    assert.ok(face.normal.x * toCentre.x + face.normal.y * toCentre.y > 0);
  }
  assert.equal(oriented.islands.length, 7);
});

test("water prism: re-entrant edges = floor–wall junctions, slope → deep floor, caps; not flat → slope", () => {
  const shell = hostOf("shell", "SHELL", shellTriangles());
  const { hosts } = classifyHostPartsByRules({ hosts: [shell], rules: RULES });
  const edges = findReentrantChains({ host: hosts[0] });
  const lengths = edges
    .map((e) => Math.round(e.length * 1e6) / 1e6)
    .sort((a, b) => a - b);
  // along the width (l): shallow wall–floor, slope–deep floor, deep wall–floor
  assert.equal(lengths.filter((x) => near(x, l)).length, 3);
  // each cap borders 2 walls and 3 floors: 10 edges in all
  const capEdges = edges.filter((e) => !near(e.length, l));
  assert.equal(capEdges.length, 10);
  assert.equal(edges.length, 13);
  // the flat → slope change at x = La is NOT re-entrant: no edge across at La
  assert.ok(
    !edges.some(
      (e) =>
        near(e.length, l) && near(e.points[0].x, La) && near(e.points[1].x, La)
    )
  );
  // the slope → deep floor change at x = L − Lb is
  assert.ok(
    edges.some(
      (e) =>
        near(e.length, l) &&
        near(e.points[0].x, L - Lb) &&
        near(e.points[1].x, L - Lb)
    )
  );
  assert.ok(edges.every((e) => e.sides.length === 2 && e.hostId === "shell"));
});

// --- (b) pit under the deep floor ------------------------------------------

test("pit cube: top ignored, bottom = floor, sides = walls; the shell floor loses its footprint", () => {
  const f = 0.5;
  const cx = L - Lb / 2;
  const cy = l / 2;
  const pit = hostOf(
    "pit",
    "PIT",
    boxTriangles(
      v(cx - f / 2, cy - f / 2, -P2 - f),
      v(cx + f / 2, cy + f / 2, -P2)
    )
  );
  const shell = hostOf("shell", "SHELL", shellTriangles());
  const classified = classifyHostPartsByRules({
    hosts: [shell, pit],
    rules: RULES,
  });
  const pitFaces = classified.faces.filter((face) => face.hostId === "pit");
  assert.equal(byCategory(pitFaces, "sol").length, 1);
  assert.equal(byCategory(pitFaces, "parois").length, 4);
  assert.ok(near(byCategory(pitFaces, "sol")[0].area, f * f));
  // bottom face points up (into the pit water), sides inward
  assert.ok(byCategory(pitFaces, "sol")[0].normal.z > 0.9);

  const welded = weldSupportFootprints({
    faces: classified.faces,
    hosts: classified.hosts,
    rules: RULES,
  });
  const deepFloor = welded.find(
    (face) => face.hostId === "shell" && face.category === "sol" && face.welded
  );
  assert.ok(deepFloor, "deep floor welded");
  assert.equal(deepFloor.polygons.length, 1);
  assert.equal(deepFloor.polygons[0].holes.length, 1);
  assert.ok(near(deepFloor.area, Lb * l - f * f, 1e-6));
  // the other floors are untouched, the pit's own faces too
  assert.equal(welded.filter((face) => face.welded).length, 1);
  assert.ok(
    near(
      sum(byCategory(welded, "sol").map((x) => x.area)),
      La * l + Lb * l + slopeLength * l,
      1e-6
    )
  );
  // pit edges never count
  assert.equal(RULES.PIT.angles, null);
});

// --- (c) low wall on a deck sheet -------------------------------------------

function openBoxTriangles(min, max) {
  // boxTriangles without its bottom face
  const all = boxTriangles(min, max);
  const out = [];
  for (let i = 0; i < all.length; i += 9) {
    const zs = [all[i + 2], all[i + 5], all[i + 8]];
    if (zs.every((z) => near(z, min.z))) continue;
    out.push(...all.slice(i, i + 9));
  }
  return out;
}

test("low wall without its base on a deck sheet: top = non-slip, walls, sheet minus footprint, base edges", () => {
  const Em = 0.35;
  const Hm = 0.45;
  const wall = hostOf(
    "wall",
    "WALL",
    openBoxTriangles(v(-Em, 0, 0), v(0, 4, Hm))
  );
  const sheet = hostOf(
    "deck",
    "DECK",
    quadTriangles(v(-1, -1, 0), v(1, -1, 0), v(1, 0.5, 0), v(-1, 0.5, 0))
  );
  const classified = classifyHostPartsByRules({
    hosts: [wall, sheet],
    rules: RULES,
  });
  const wallFaces = classified.faces.filter((face) => face.hostId === "wall");
  assert.equal(byCategory(wallFaces, "antiderapant").length, 1);
  assert.ok(near(byCategory(wallFaces, "antiderapant")[0].area, Em * 4));
  assert.ok(byCategory(wallFaces, "antiderapant")[0].normal.z > 0.9);
  assert.equal(byCategory(wallFaces, "parois").length, 4);
  // outward normals: the pool-side face (x = 0) points to +x
  const inner = byCategory(wallFaces, "parois").find((face) =>
    face.polygons[0].contour.every((p) => near(p.x, 0))
  );
  assert.ok(inner.normal.x > 0.9);

  const deckFaces = classified.faces.filter((face) => face.hostId === "deck");
  assert.equal(deckFaces.length, 1);
  assert.equal(deckFaces[0].category, "antiderapant");

  const welded = weldSupportFootprints({
    faces: classified.faces,
    hosts: classified.hosts,
    rules: RULES,
  });
  const deck = welded.find((face) => face.hostId === "deck");
  assert.ok(deck.welded);
  assert.ok(near(deck.area, 2 * 1.5 - Em * 0.5, 1e-6));

  const wallHost = classified.hosts.find((h) => h.hostId === "wall");
  const supports = classified.hosts.filter((h) => h.hostId !== "wall");
  const edges = findBaseEdgesOnSupports({ host: wallHost, supports });
  // only the cap at y = 0 stands on the sheet (its probe falls at y = −5 mm)
  assert.equal(edges.length, 1);
  assert.ok(near(edges[0].length, Em));
  assert.ok(edges[0].points.every((p) => near(p.y, 0) && near(p.z, 0)));
  assert.ok(edges[0].sides[0].y < -0.9 && edges[0].sides[1].z > 0.9);
});

// --- (d) gutter sheet: only the level-0 part counts ------------------------

test("gutter sheet with a 2 cm rebate: only the faces at z ≈ 0 are non-slip", () => {
  const out = [];
  quadTriangles(v(0, 0, 0), v(1, 0, 0), v(1, 2, 0), v(0, 2, 0), out); // deck
  quadTriangles(v(1, 0, 0), v(1, 0, -0.02), v(1, 2, -0.02), v(1, 2, 0), out); // riser
  quadTriangles(
    v(1, 0, -0.02),
    v(1.5, 0, -0.02),
    v(1.5, 2, -0.02),
    v(1, 2, -0.02),
    out
  ); // seat
  const gutter = hostOf("gutter", "DECK", out);
  const { faces } = classifyHostPartsByRules({ hosts: [gutter], rules: RULES });
  assert.equal(faces.length, 1);
  assert.equal(faces[0].category, "antiderapant");
  assert.ok(near(faces[0].area, 2));
  assert.ok(faces[0].normal.z > 0.9);
});

test("podium sheet: sloped top is non-slip, back and front are walls", () => {
  const out = [];
  const Hm = 0.45;
  // side view swept along y ∈ [1, 1.5]: back at x = −0.5 (0.5 high), top
  // sloping to 0.45 at the pool side x = 0, front at x = 0
  quadTriangles(
    v(-0.5, 1, Hm),
    v(-0.5, 1.5, Hm),
    v(-0.5, 1.5, Hm + 0.5),
    v(-0.5, 1, Hm + 0.5),
    out
  );
  quadTriangles(
    v(-0.5, 1, Hm + 0.5),
    v(-0.5, 1.5, Hm + 0.5),
    v(0, 1.5, Hm + 0.45),
    v(0, 1, Hm + 0.45),
    out
  );
  quadTriangles(
    v(0, 1, Hm + 0.45),
    v(0, 1.5, Hm + 0.45),
    v(0, 1.5, Hm),
    v(0, 1, Hm),
    out
  );
  const podium = hostOf("podium", "PODIUM", out);
  const { faces } = classifyHostPartsByRules({ hosts: [podium], rules: RULES });
  assert.equal(byCategory(faces, "antiderapant").length, 1);
  assert.equal(byCategory(faces, "parois").length, 2);
  const top = byCategory(faces, "antiderapant")[0];
  assert.ok(top.normal.z > DEFAULT_QTES_THRESHOLDS.SLOPED_TOP_NZ_MIN);
  const front = byCategory(faces, "parois").find((f) =>
    f.polygons[0].contour.every((p) => near(p.x, 0))
  );
  assert.ok(front.normal.x > 0.9, "front face points toward the pool");
});

// --- (e) closed stepped prism: a low wall carrying a podium ----------------

// Low wall x ∈ [0, e], y ∈ [0, 4], z ∈ [0, h] with a podium y ∈ [1, 1.5]
// raised to h + ph — a watertight soup (side faces split at the podium).
function steppedWallTriangles({ e = 0.35, h = 0.45, ph = 0.5 } = {}) {
  const out = [];
  const ys = [0, 1, 1.5, 4];
  const top = (i) => (i === 1 ? h + ph : h);
  for (let i = 0; i < 3; i++) {
    const [y0, y1] = [ys[i], ys[i + 1]];
    const z = top(i);
    quadTriangles(v(0, y0, z), v(e, y0, z), v(e, y1, z), v(0, y1, z), out); // top
    quadTriangles(v(0, y0, 0), v(0, y1, 0), v(e, y1, 0), v(e, y0, 0), out); // bottom
    quadTriangles(v(0, y1, 0), v(0, y0, 0), v(0, y0, z), v(0, y1, z), out); // x = 0
    quadTriangles(v(e, y0, 0), v(e, y1, 0), v(e, y1, z), v(e, y0, z), out); // x = e
  }
  quadTriangles(v(0, 0, 0), v(e, 0, 0), v(e, 0, h), v(0, 0, h), out); // y = 0
  quadTriangles(v(e, 4, 0), v(0, 4, 0), v(0, 4, h), v(e, 4, h), out); // y = 4
  // podium risers (between the head and the podium top)
  quadTriangles(v(e, 1, h), v(0, 1, h), v(0, 1, h + ph), v(e, 1, h + ph), out);
  quadTriangles(
    v(0, 1.5, h),
    v(e, 1.5, h),
    v(e, 1.5, h + ph),
    v(0, 1.5, h + ph),
    out
  );
  return out;
}

test("closed low wall with a podium: outward normals kept, feet of the podium are re-entrant", () => {
  const e = 0.35;
  const h = 0.45;
  const ph = 0.5;
  const index = buildHostPartIndex({
    triangles: Float64Array.from(steppedWallTriangles({ e, h, ph })),
  });
  assert.equal(index.isClosed, true);
  const wall = {
    hostId: "wall",
    role: "WALL",
    islands: index.islands,
    chains: index.chains,
    box: index.box,
    isClosed: index.isClosed,
  };
  const rules = {
    ...RULES,
    WALL: { ...RULES.WALL, angles: ["INTRA", "BASE"] },
  };
  const { faces, edges, totals } = meterHostParts({ hosts: [wall], rules });
  // head (2 parts) + podium top = the whole footprint, all facing up
  const tops = byCategory(faces, "antiderapant");
  assert.equal(tops.length, 3);
  assert.ok(tops.every((f) => f.normal.z > 0.9));
  assert.ok(near(totals.antiderapant, e * 4, 1e-6));
  // 4 sides of the wall (podium fronts merged in the long sides) + 2 risers
  assert.ok(
    near(totals.parois, 2 * (4 + e) * h + 2 * 0.5 * ph + 2 * e * ph, 1e-6)
  );
  // risers face away from the podium, toward their neighbouring head
  const risers = byCategory(faces, "parois").filter((f) =>
    f.polygons[0].contour.every((p) => near(p.y, 1) || near(p.y, 1.5))
  );
  assert.equal(risers.length, 2);
  for (const riser of risers) {
    const y = riser.polygons[0].contour[0].y;
    assert.ok(near(y, 1) ? riser.normal.y < -0.9 : riser.normal.y > 0.9);
  }
  // re-entrant: the two podium feet on the head (no support: no base edge)
  assert.equal(edges.length, 2);
  assert.ok(
    edges.every((x) => near(x.length, e) && x.points.every((p) => near(p.z, h)))
  );
  assert.ok(near(totals.angles, 2 * e, 1e-6));
});
