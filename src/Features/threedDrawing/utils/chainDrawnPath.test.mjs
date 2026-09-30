import assert from "node:assert/strict";
import { test } from "node:test";

import chainDrawnPath from "./chainDrawnPath.js";

const p = (x, y, z = 0) => ({ x, y, z });
const xy = (v) => `${v.x},${v.y}`;

test("a lone segment stays as drawn", () => {
  const chain = chainDrawnPath([p(0, 0), p(1, 0)], []);
  assert.deepEqual(chain.vertices.map(xy), ["0,0", "1,0"]);
  assert.equal(chain.closed, false);
  assert.equal(chain.usedTraits.length, 0);
});

test("segments drawn separately chain into one path, from both ends", () => {
  // Notch: (0,0)-(0,1) and (1,1)-(1,0) already drawn, (0,1)-(1,1) closes it.
  const traits = [
    { a: p(0, 0), b: p(0, 1) },
    { a: p(1, 0), b: p(1, 1) },
  ];
  const chain = chainDrawnPath([p(0, 1), p(1, 1)], traits);
  assert.deepEqual(chain.vertices.map(xy), ["0,0", "0,1", "1,1", "1,0"]);
  assert.equal(chain.closed, false);
  assert.equal(chain.usedTraits.length, 2);
});

test("a chain whose ends meet is closed, without the duplicate", () => {
  const traits = [
    { a: p(0, 0), b: p(1, 0) },
    { a: p(1, 0), b: p(1, 1) },
    { a: p(1, 1), b: p(0, 1) },
  ];
  const chain = chainDrawnPath([p(0, 1), p(0, 0)], traits);
  assert.equal(chain.closed, true);
  assert.equal(chain.vertices.length, 4);
  assert.equal(chain.usedTraits.length, 3);
});

test("a path clicked back on its first point is closed", () => {
  const chain = chainDrawnPath([p(0, 0), p(1, 0), p(1, 1), p(0, 0)], []);
  assert.equal(chain.closed, true);
  assert.equal(chain.vertices.length, 3);
});

test("a fork stops the walk", () => {
  const traits = [
    { a: p(1, 0), b: p(2, 0) },
    { a: p(1, 0), b: p(1, 5) },
    { a: p(9, 9), b: p(8, 8) },
  ];
  const chain = chainDrawnPath([p(0, 0), p(1, 0)], traits);
  assert.deepEqual(chain.vertices.map(xy), ["0,0", "1,0"]);
  assert.equal(chain.usedTraits.length, 0);
});
