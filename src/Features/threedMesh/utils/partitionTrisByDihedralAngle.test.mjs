import assert from "node:assert/strict";
import { test } from "node:test";

import { foldedStrip } from "../../threedCutLines/utils/cutLineFixtures.mjs";
import partitionTrisByDihedralAngle from "./partitionTrisByDihedralAngle.js";

test("a strip folded at 10° is one part at 25° and one facet per quad at 0.1°", () => {
  const strip = foldedStrip({ count: 3, foldDeg: 10 });
  const wide = partitionTrisByDihedralAngle({
    positions: strip.positions,
    tris: strip.tris,
    index: null,
    angleDeg: 25,
  });
  assert.equal(wide.parts.length, 1);
  assert.equal(wide.parts[0].length, 6);

  const tight = partitionTrisByDihedralAngle({
    positions: strip.positions,
    tris: strip.tris,
    index: null,
    angleDeg: 0.1,
  });
  assert.equal(tight.parts.length, 3);
  for (const part of tight.parts) assert.equal(part.length, 2);
  assert.equal(tight.partOfTri.get(0), tight.partOfTri.get(1));
  assert.notEqual(tight.partOfTri.get(1), tight.partOfTri.get(2));
});

test("a 90° crease separates the parts at 25°", () => {
  const strip = foldedStrip({ count: 2, foldDeg: 90 });
  const result = partitionTrisByDihedralAngle({
    positions: strip.positions,
    tris: strip.tris,
    index: null,
    angleDeg: 25,
  });
  assert.equal(result.parts.length, 2);
});

test("edges list the triangles sharing each welded edge", () => {
  const strip = foldedStrip({ count: 2, foldDeg: 10 });
  const { edges } = partitionTrisByDihedralAngle({
    positions: strip.positions,
    tris: strip.tris,
    index: null,
    angleDeg: 0.1,
  });
  // 2 quads: 7 distinct edges (4 + 4 - 1 shared) + 2 diagonals.
  assert.equal(edges.length, 9);
  const shared = edges.filter((e) => e.tris.length === 2);
  // 2 diagonals + the seam between the quads.
  assert.equal(shared.length, 3);
  const seam = shared.find(
    (e) => Math.abs(e.a.x - 1) < 1e-9 && Math.abs(e.b.x - 1) < 1e-9
  );
  assert.ok(seam);
  assert.deepEqual([...seam.tris].sort(), [0, 3]);
});
