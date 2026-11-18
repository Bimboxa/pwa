import assert from "node:assert/strict";
import test from "node:test";

import getMeshes3dContrastedColors, {
  getContrastedShades,
} from "./getMeshes3dContrastedColors.js";

const BASE = "#2f6f8f";

// Adjacency by explicit pairs (ids).
const adjacency = (pairs) => (mesh3d, rows) =>
  rows.filter((r) =>
    pairs.some(
      ([a, b]) =>
        (a === mesh3d.id && b === r.id) || (b === mesh3d.id && a === r.id)
    )
  );

test("the first shade is the base color itself", () => {
  assert.equal(getContrastedShades(BASE)[0], BASE);
});

test("a strip of touching mailles never repeats a shade side by side", () => {
  const rows = [1, 2, 3, 4, 5, 6].map((number) => ({
    id: `m${number}`,
    number,
  }));
  const pairs = rows.slice(1).map((r, i) => [rows[i].id, r.id]);
  const colors = getMeshes3dContrastedColors(rows, BASE, {
    findAdjacent: adjacency(pairs),
  });
  assert.equal(colors.size, rows.length);
  pairs.forEach(([a, b]) => assert.notEqual(colors.get(a), colors.get(b)));
});

test("four mailles all touching each other get four distinct shades", () => {
  const rows = [1, 2, 3, 4].map((number) => ({ id: `m${number}`, number }));
  const pairs = [];
  rows.forEach((a, i) =>
    rows.slice(i + 1).forEach((b) => pairs.push([a.id, b.id]))
  );
  const colors = getMeshes3dContrastedColors(rows, BASE, {
    findAdjacent: adjacency(pairs),
  });
  assert.equal(new Set(colors.values()).size, 4);
});

test("isolated mailles still vary with their rank", () => {
  const rows = [
    { id: "a", number: 7 },
    { id: "b", number: 3 },
  ];
  const colors = getMeshes3dContrastedColors(rows, BASE, {
    findAdjacent: () => [],
  });
  assert.equal(colors.get("b"), BASE); // lowest number first
  assert.notEqual(colors.get("a"), colors.get("b"));
});
