import assert from "node:assert/strict";
import { test } from "node:test";

import computeChordPieces from "./computeChordPieces.js";

const square = (x, y) => ({ x, y, type: "square" });
const circle = (x, y) => ({ x, y, type: "circle" });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const chord = (p) => Math.hypot(p.end.x - p.start.x, p.end.y - p.start.y);

test("a straight line is cut every step, the rest is a shorter piece", () => {
  const pieces = computeChordPieces({
    points: [square(0, 0), square(5.5, 0)],
    step: 1,
    minPiece: 0.001,
  });
  assert.equal(pieces.length, 6);
  pieces.slice(0, 5).forEach((p) => assert.ok(near(chord(p), 1)));
  assert.ok(near(chord(pieces[5]), 0.5));
  assert.ok(near(pieces[5].end.x, 5.5));
});

test("an exact multiple leaves no extra piece", () => {
  const pieces = computeChordPieces({
    points: [square(0, 0), square(3, 0)],
    step: 1,
    minPiece: 0.001,
  });
  assert.equal(pieces.length, 3);
});

test("the walk restarts at an angle break", () => {
  const pieces = computeChordPieces({
    points: [square(0, 0), square(2.5, 0), square(2.5, 1.5)],
    step: 1,
    minPiece: 0.001,
  });
  // 1 + 1 + 0.5 | 1 + 0.5
  assert.deepEqual(
    pieces.map((p) => Math.round(chord(p) * 1000) / 1000),
    [1, 1, 0.5, 1, 0.5]
  );
  assert.ok(near(pieces[3].start.x, 2.5) && near(pieces[3].start.y, 0));
});

test("an arc is walked chord by chord", () => {
  // Half circle of radius 2 from (-2, 0) to (2, 0) through (0, 2).
  const pieces = computeChordPieces({
    points: [square(-2, 0), circle(0, 2), square(2, 0)],
    step: 1,
    minPiece: 0.001,
  });
  // chord 1 on R = 2 -> 2 * asin(0.25) per piece
  const full = Math.floor(Math.PI / (2 * Math.asin(0.25)));
  assert.equal(pieces.length, full + 1);
  pieces.slice(0, full).forEach((p) => {
    assert.ok(near(chord(p), 1));
    assert.ok(near(Math.hypot(p.end.x, p.end.y), 2));
  });
  const last = pieces[pieces.length - 1];
  assert.ok(chord(last) < 1);
  assert.ok(near(last.end.x, 2) && near(last.end.y, 0));
});

test("a closed circle made of two arcs is one run with one short piece", () => {
  const pieces = computeChordPieces({
    points: [square(-2, 0), circle(0, 2), square(2, 0), circle(0, -2)],
    closeLine: true,
    step: 1,
    minPiece: 0.001,
  });
  const full = Math.floor((2 * Math.PI) / (2 * Math.asin(0.25)));
  assert.equal(pieces.length, full + 1);
  assert.equal(pieces.filter((p) => chord(p) < 0.999).length, 1);
  const last = pieces[pieces.length - 1];
  assert.ok(near(last.end.x, -2) && near(last.end.y, 0));
});

test("a line tangent to an arc stays in the same run", () => {
  // Line along +x then a quarter arc leaving tangentially (center (2, 2)).
  const c = Math.SQRT1_2;
  const pieces = computeChordPieces({
    points: [
      square(0, 0),
      square(2, 0),
      circle(2 + 2 * c, 2 - 2 * c),
      square(4, 2),
    ],
    step: 1.5,
    minPiece: 0.001,
  });
  // No piece ends at the junction (2, 0).
  assert.ok(pieces.every((p) => !(near(p.end.x, 2) && near(p.end.y, 0))));
  pieces.slice(0, -1).forEach((p) => assert.ok(near(chord(p), 1.5)));
});

test("a step longer than the run gives the run itself", () => {
  const pieces = computeChordPieces({
    points: [square(-2, 0), circle(0, 2), square(2, 0)],
    step: 10,
  });
  assert.equal(pieces.length, 1);
  assert.ok(near(chord(pieces[0]), 4));
});

test("invalid inputs give no piece", () => {
  assert.deepEqual(computeChordPieces({ points: [square(0, 0)], step: 1 }), []);
  assert.deepEqual(
    computeChordPieces({ points: [square(0, 0), square(1, 0)], step: 0 }),
    []
  );
});
