import assert from "node:assert/strict";
import { test } from "node:test";

import { getRevolutionAxisContourArcs } from "./revolutionAxisGlyph.js";

const PI = Math.PI;
const total = (arcs, visible) =>
  arcs
    .filter((a) => a.visible === visible)
    .reduce((sum, a) => sum + (a.to - a.from), 0);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("full circle, half-view: one visible half, one hidden half", () => {
  const arcs = getRevolutionAxisContourArcs({ theta: 0.3 });
  near(total(arcs, true), PI);
  near(total(arcs, false), PI);
  // visible = the +90° CCW side of the diameter
  const visible = arcs.find((a) => a.visible);
  near(visible.from, 0.3);
  near(visible.to, 0.3 + PI);
  assert.ok(arcs.every((a) => a.to - a.from <= PI + 1e-9));
});

test("full circle, half-view off: everything visible, no arc wider than π", () => {
  const arcs = getRevolutionAxisContourArcs({ theta: 1, halfView: false });
  near(total(arcs, true), 2 * PI);
  assert.equal(total(arcs, false), 0);
  assert.ok(arcs.every((a) => a.to - a.from <= PI + 1e-9));
});

test("partial sector crossing the cut axis is split in visible / hidden", () => {
  // diameter along +X: visible half = angles in [0, π]
  const arcs = getRevolutionAxisContourArcs({
    theta: 0,
    partial: true,
    angleStart: -PI / 4,
    angleEnd: PI / 2,
  });
  near(total(arcs, false), PI / 4);
  near(total(arcs, true), PI / 2);
  near(arcs[0].from, -PI / 4);
  assert.equal(arcs[0].visible, false);
  near(arcs[arcs.length - 1].to, PI / 2);
  assert.equal(arcs[arcs.length - 1].visible, true);
});

test("partial sector wrapping past 2π keeps its CCW span", () => {
  const arcs = getRevolutionAxisContourArcs({
    theta: 0,
    partial: true,
    angleStart: (3 * PI) / 2,
    angleEnd: PI / 2,
  });
  near(total(arcs, true) + total(arcs, false), PI);
  near(total(arcs, true), PI / 2);
});

test("partial sector entirely on the hidden side", () => {
  const arcs = getRevolutionAxisContourArcs({
    theta: 0,
    partial: true,
    angleStart: -PI / 2,
    angleEnd: -PI / 4,
  });
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].visible, false);
});
