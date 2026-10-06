import assert from "node:assert/strict";
import { test } from "node:test";

import computeRevolutionAxisPageSetup from "./computeRevolutionAxisPageSetup.js";

// A3: 297 x 420 mm. Portrait at 1:S holds 0.297·S m wide (axis at the
// middle → ±0.1485·S m) and 0.42·S m high (base at 90% → 0.378·S m above).

test("small axis → 1:10 portrait", () => {
  // half width 0.5 + 0.1 margin ≤ 1.485 ; height 2 + 0.1 ≤ 3.78
  assert.deepEqual(
    computeRevolutionAxisPageSetup({ radiusM: 0.5, heightM: 2 }),
    {
      format: "portrait",
      size: "A3",
      scale: 10,
      fits: true,
    }
  );
});

test("r = 3 m, h = 5 m → 1:25 portrait", () => {
  // 1:10 fails (3 + 0.1 > 1.485) ; 1:25 portrait: 3.1 ≤ 3.7125, 5.25 ≤ 9.45
  assert.deepEqual(computeRevolutionAxisPageSetup({ radiusM: 3, heightM: 5 }), {
    format: "portrait",
    size: "A3",
    scale: 25,
    fits: true,
  });
});

test("wide and short axis → paysage before the next scale", () => {
  // 1:25 portrait: half width 4 + 0.25 > 3.7125 ; paysage: 4.25 ≤ 5.25,
  // height 1.25 ≤ 6.6825 → paysage at 1:25 beats portrait at 1:50
  assert.deepEqual(computeRevolutionAxisPageSetup({ radiusM: 4, heightM: 1 }), {
    format: "paysage",
    size: "A3",
    scale: 25,
    fits: true,
  });
});

test("huge axis → best-effort fallback", () => {
  assert.deepEqual(
    computeRevolutionAxisPageSetup({ radiusM: 40, heightM: 80 }),
    { format: "portrait", size: "A3", scale: 100, fits: false }
  );
});

test("missing scalars are treated as zero", () => {
  const setup = computeRevolutionAxisPageSetup({
    radiusM: null,
    heightM: undefined,
  });
  assert.equal(setup.scale, 10);
  assert.equal(setup.fits, true);
});
