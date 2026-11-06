import assert from "node:assert/strict";
import { test } from "node:test";

import { buildJunctionCap, getFlatSection } from "./sweepFlatJunction.js";

const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

// Sum of the triangle areas of a cap.
const capArea = (cap) => {
  let area = 0;
  for (let i = 0; i < cap.triangles.length; i += 3) {
    const a = cap.points[cap.triangles[i]];
    const b = cap.points[cap.triangles[i + 1]];
    const c = cap.points[cap.triangles[i + 2]];
    area += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }
  return area;
};

test("flat section is the first → last chord", () => {
  const section = [
    { x: 0, y: 0 },
    { x: 1, y: -1 },
    { x: 2, y: 0.5 },
  ];
  assert.deepEqual(getFlatSection(section), [section[0], section[2]]);
  const uw = section.map((p) => ({ u: p.x, w: p.y }));
  assert.deepEqual(getFlatSection(uw, ["u", "w"]), [uw[0], uw[2]]);
});

test("flat section is subdivided at the profile vertices lying on the chord", () => {
  // Lips + groove: vertices 1 and 4 sit on the chord.
  const groove = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -0.5 },
    { x: 2, y: -0.5 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ];
  assert.deepEqual(getFlatSection(groove), [
    groove[0],
    groove[1],
    groove[4],
    groove[5],
  ]);
  // Same on a sloped chord, in {u, w}.
  const sloped = groove.map((p) => ({ u: p.x - p.y, w: p.x + p.y }));
  assert.deepEqual(getFlatSection(sloped, ["u", "w"]), [
    sloped[0],
    sloped[1],
    sloped[4],
    sloped[5],
  ]);
});

test("flat section is subdivided where the profile crosses its chord", () => {
  const z = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: -1 },
    { x: 2, y: 0 },
  ];
  const flat = getFlatSection(z);
  assert.equal(flat.length, 3);
  near(flat[1].x, 1);
  near(flat[1].y, 0);
  // The very point the cap lobes meet at (identical coordinates).
  const cap = buildJunctionCap(z);
  assert.ok(cap.points.some((p) => p.x === flat[1].x && p.y === flat[1].y));
});

test("contacts outside the chord or repeated are ignored", () => {
  // Overhang beyond the last point, back on the chord line at x = 3, and a
  // fold coming back onto vertex (1, 0).
  const section = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 0 },
  ];
  const flat = getFlatSection(section);
  assert.deepEqual(
    flat.map((p) => p.x),
    [0, 1, 2]
  );
});

test("closed profile has no flat section", () => {
  assert.equal(
    getFlatSection([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
    ]),
    null
  );
});

test("straight profile needs no cap", () => {
  assert.equal(
    buildJunctionCap([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
    null
  );
  assert.equal(
    buildJunctionCap([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]),
    null
  );
});

test("V profile: one lobe, the triangle under the chord", () => {
  const cap = buildJunctionCap([
    { x: 0, y: 0 },
    { x: 1, y: -1 },
    { x: 2, y: 0 },
  ]);
  assert.ok(cap);
  assert.equal(cap.triangles.length, 3);
  near(capArea(cap), 1);
});

test("gutter profile on a sloped chord", () => {
  // U gutter hanging under a chord climbing from (0,0) to (4,2).
  const cap = buildJunctionCap([
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: 4, y: -1 },
    { x: 4, y: 2 },
  ]);
  assert.ok(cap);
  // Trapezoid between y = -1 and the chord: 4 × (1 + 3) / 2.
  near(capArea(cap), 8);
});

test("Z profile crossing its chord: one lobe per side", () => {
  const cap = buildJunctionCap([
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: -1 },
    { x: 2, y: 0 },
  ]);
  assert.ok(cap);
  // Two triangles of area 0.5 meeting at the crossing (1, 0).
  assert.equal(cap.triangles.length, 6);
  near(capArea(cap), 1);
  assert.ok(cap.points.some((p) => Math.abs(p.x - 1) < 1e-9 && p.y === 0));
});

test("profile touching its chord midway splits into two lobes", () => {
  const cap = buildJunctionCap([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
    { x: 3, y: 1 },
    { x: 4, y: 0 },
  ]);
  assert.ok(cap);
  near(capArea(cap), 2);
});

test("closed profile: the cap is the whole ring", () => {
  const cap = buildJunctionCap([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ]);
  assert.ok(cap);
  near(capArea(cap), 1);
});
