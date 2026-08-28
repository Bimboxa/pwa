// Node replay of the layer-stacking geometry (material layers on STRIPs).
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/layerStackingReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/layerStackingReplay.mjs && node /tmp/layerStackingReplay.mjs
//
// Scenarios: the user's validated 4-layer example (idealized coordinates,
// t = 48 px exactly), antiparallel coverage, ramp/corner loop removal,
// staircase envelope, coverage gap, orientation flip, skip rules, ordering
// helpers. Exits 1 on any failure.

import getLayerStackProfile from "Features/geometry/utils/getLayerStackProfile";
import offsetPolylineVariable from "Features/geometry/utils/offsetPolylineVariable";
import applyLayerStackingToAnnotations from "Features/annotations/utils/applyLayerStackingToAnnotations";
import {
  sortLayerStrips,
  getNextLayerIndexKey,
  buildReorderUpdates,
} from "Features/annotations/utils/layerStackOrder";

let failures = 0;

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const TOL = 0.05;

function checkPoints(label, actual, expected) {
  if ((actual?.length ?? 0) !== expected.length) {
    check(
      label,
      false,
      `expected ${expected.length} points, got ${actual?.length}: ${JSON.stringify(
        (actual || []).map((p) => [
          Math.round(p.x * 100) / 100,
          Math.round(p.y * 100) / 100,
        ])
      )}`
    );
    return;
  }
  for (let i = 0; i < expected.length; i++) {
    const [ex, ey] = expected[i];
    const dx = Math.abs(actual[i].x - ex);
    const dy = Math.abs(actual[i].y - ey);
    if (dx > TOL || dy > TOL) {
      check(
        label,
        false,
        `point ${i}: expected (${ex}, ${ey}), got (${actual[i].x.toFixed(3)}, ${actual[i].y.toFixed(3)})`
      );
      return;
    }
  }
  check(label, true);
}

const pts = (arr) => arr.map(([x, y]) => ({ x, y }));

// t = 48 px exactly: 10 CM at meterByPx = 0.1 / 48.
const METER_BY_PX = 0.1 / 48;
const T = 48;

// ---------------------------------------------------------------------------
console.log("— user 4-layer example (idealized) —");
// Support lines (y-down, drawn right→left then up-screen, orientation +1):
const L1 = pts([
  [1670, 1340],
  [300, 1340],
  [300, 735],
]);
const L2 = pts([
  [1310, 1340],
  [300, 1340],
  [300, 275],
]);
const L3 = pts([
  [1670, 1340],
  [410, 1340],
]);
const L4 = pts([
  [1570, 1340],
  [300, 1340],
  [300, 50],
]);

const mkLayer = (id, points, createdAt, extra = {}) => ({
  id,
  type: "STRIP",
  isLayer: true,
  baseMapId: "bm",
  strokeWidth: 10,
  strokeWidthUnit: "CM",
  stripOrientation: 1,
  createdAt,
  points,
  ...extra,
});

const fourLayers = [
  mkLayer("l1", L1, "2026-01-01T00:00:01Z"),
  mkLayer("l2", L2, "2026-01-01T00:00:02Z"),
  mkLayer("l3", L3, "2026-01-01T00:00:03Z"),
  mkLayer("l4", L4, "2026-01-01T00:00:04Z"),
];

{
  const map = applyLayerStackingToAnnotations(fourLayers, {
    baseMapId: "bm",
    meterByPx: METER_BY_PX,
  });
  check("first layer stays as drawn", !map.has("l1"));
  checkPoints(
    "layer 2: rides layer 1, 45° drop at its wall top",
    map.get("l2"),
    [
      [1310, 1340 - T],
      [300 + T, 1340 - T],
      [300 + T, 735],
      [300, 735 - T],
      [300, 275],
    ]
  );
  checkPoints("layer 3: climbs over layer 2's start at 45°", map.get("l3"), [
    [1670, 1340 - T],
    [1358, 1340 - T],
    [1310, 1340 - 2 * T],
    [410, 1340 - 2 * T],
  ]);
  checkPoints(
    "layer 4: staircase + ramp stopped by the corner run",
    map.get("l4"),
    [
      [1570, 1340 - 2 * T],
      [1358, 1340 - 2 * T],
      [1310, 1340 - 3 * T],
      [410, 1340 - 3 * T],
      [300 + 2 * T, 1210],
      [300 + 2 * T, 735],
      [300 + T, 735 - T],
      [300 + T, 275],
      [300, 275 - T],
      [300, 50],
    ]
  );
}

// ---------------------------------------------------------------------------
console.log("— antiparallel coverage —");
{
  const map = applyLayerStackingToAnnotations(
    [
      mkLayer(
        "a",
        pts([
          [300, 1340],
          [1670, 1340],
        ]),
        "2026-01-01T00:00:01Z"
      ),
      mkLayer(
        "b",
        pts([
          [1310, 1340],
          [300, 1340],
        ]),
        "2026-01-01T00:00:02Z"
      ),
    ],
    { baseMapId: "bm", meterByPx: METER_BY_PX }
  );
  checkPoints("reversed underlier covers identically", map.get("b"), [
    [1310, 1340 - T],
    [300, 1340 - T],
  ]);
}

// ---------------------------------------------------------------------------
console.log("— staircase: two close steps chain into one 45° slope —");
{
  // u1 covers x ∈ [0, 500], u2 covers x ∈ [0, 520]; layer travels 1000 → 0.
  const profile = getLayerStackProfile(
    pts([
      [1000, 1340],
      [0, 1340],
    ]),
    [
      {
        chunks: [
          pts([
            [0, 1340],
            [500, 1340],
          ]),
        ],
        thicknessPx: T,
      },
      {
        chunks: [
          pts([
            [0, 1340],
            [520, 1340],
          ]),
        ],
        thicknessPx: T,
      },
    ]
  );
  const out = offsetPolylineVariable(
    pts([
      [1000, 1340],
      [0, 1340],
    ]),
    profile
  );
  checkPoints("single continuous ramp from 0 to 2t", out, [
    [1000, 1340],
    [596, 1340],
    [500, 1340 - 2 * T],
    [0, 1340 - 2 * T],
  ]);
}

// ---------------------------------------------------------------------------
console.log("— coverage gap: ramp down then up at 45° —");
{
  // u covers x ∈ [600, 1000] and x ∈ [0, 400]; layer travels 1000 → 0.
  const profile = getLayerStackProfile(
    pts([
      [1000, 1340],
      [0, 1340],
    ]),
    [
      {
        chunks: [
          pts([
            [600, 1340],
            [1000, 1340],
          ]),
          pts([
            [0, 1340],
            [400, 1340],
          ]),
        ],
        thicknessPx: T,
      },
    ]
  );
  const out = offsetPolylineVariable(
    pts([
      [1000, 1340],
      [0, 1340],
    ]),
    profile
  );
  checkPoints("down/up ramps around the gap", out, [
    [1000, 1340 - T],
    [600, 1340 - T],
    [552, 1340],
    [448, 1340],
    [400, 1340 - T],
    [0, 1340 - T],
  ]);
}

// ---------------------------------------------------------------------------
console.log("— hidden segments of an underlier contribute no thickness —");
{
  const map = applyLayerStackingToAnnotations(
    [
      mkLayer(
        "u",
        pts([
          [0, 1340],
          [400, 1340],
          [800, 1340],
        ]),
        "2026-01-01T00:00:01Z",
        { hiddenSegmentsIdx: [1] }
      ),
      mkLayer(
        "v",
        pts([
          [1000, 1340],
          [0, 1340],
        ]),
        "2026-01-01T00:00:02Z"
      ),
    ],
    { baseMapId: "bm", meterByPx: METER_BY_PX }
  );
  checkPoints("only the visible chunk stacks", map.get("v"), [
    [1000, 1340],
    [448, 1340],
    [400, 1340 - T],
    [0, 1340 - T],
  ]);
}

// ---------------------------------------------------------------------------
console.log("— stripOrientation −1 flips the stack side —");
{
  const map = applyLayerStackingToAnnotations(
    [
      mkLayer(
        "a",
        pts([
          [0, 1340],
          [1000, 1340],
        ]),
        "2026-01-01T00:00:01Z"
      ),
      mkLayer(
        "b",
        pts([
          [800, 1340],
          [100, 1340],
        ]),
        "2026-01-01T00:00:02Z",
        {
          stripOrientation: -1,
        }
      ),
    ],
    { baseMapId: "bm", meterByPx: METER_BY_PX }
  );
  checkPoints("flipped layer stacks below the support", map.get("b"), [
    [800, 1340 + T],
    [100, 1340 + T],
  ]);
}

// ---------------------------------------------------------------------------
console.log("— degenerate / skip rules —");
{
  const overlapBelowThreshold = getLayerStackProfile(
    pts([
      [0, 0],
      [100, 0],
    ]),
    [
      {
        chunks: [
          pts([
            [50, 0],
            [50.4, 0],
          ]),
        ],
        thicknessPx: T,
      },
    ]
  );
  check("sub-0.5px overlap ignored", overlapBelowThreshold === null);

  const nonColinear = getLayerStackProfile(
    pts([
      [0, 0],
      [100, 0],
    ]),
    [
      {
        chunks: [
          pts([
            [0, 10],
            [100, 10],
          ]),
        ],
        thicknessPx: T,
      },
    ]
  );
  check("segment 10px off the line does not cover", nonColinear === null);

  const dupPoint = offsetPolylineVariable(
    pts([
      [0, 0],
      [50, 0],
      [50, 0],
      [100, 0],
    ]),
    [
      { s: 0, d: T },
      { s: 100, d: T },
    ]
  );
  // Travel is left→right here, so the left-of-travel normal points to +y.
  check(
    "zero-length segment: no NaN, constant offset",
    dupPoint.every((p) => Number.isFinite(p.x) && Math.abs(p.y - T) < TOL)
  );

  const map = applyLayerStackingToAnnotations(
    [
      mkLayer(
        "a",
        pts([
          [0, 0],
          [1000, 0],
        ]),
        "2026-01-01T00:00:01Z"
      ),
      mkLayer(
        "closed",
        pts([
          [0, 0],
          [400, 0],
          [400, 400],
          [0, 0],
        ]),
        "2026-01-01T00:00:02Z"
      ),
      mkLayer(
        "arc",
        pts([
          [800, 0],
          [100, 0],
        ]),
        "2026-01-01T00:00:03Z",
        {
          points: [
            { x: 800, y: 0 },
            { x: 450, y: 0, type: "circle" },
            { x: 100, y: 0 },
          ],
        }
      ),
    ],
    { baseMapId: "bm", meterByPx: METER_BY_PX }
  );
  check("closed layer renders unstacked", !map.has("closed"));
  check("arc layer renders unstacked", !map.has("arc"));
}

// ---------------------------------------------------------------------------
console.log("— stack order helpers —");
{
  const rows = [
    { id: "c", layerIndex: "a1", createdAt: "2026-01-01T00:00:03Z" },
    { id: "a", layerIndex: null, createdAt: "2026-01-01T00:00:01Z" },
    { id: "b", layerIndex: "a0", createdAt: "2026-01-01T00:00:02Z" },
  ];
  const sorted = sortLayerStrips(rows).map((r) => r.id);
  check(
    "missing keys first (createdAt), then fractional order",
    JSON.stringify(sorted) === JSON.stringify(["a", "b", "c"])
  );

  const nextKey = getNextLayerIndexKey(rows);
  check("next key sorts after every existing key", nextKey > "a1");

  const updates = buildReorderUpdates(rows, "c", "down");
  const reordered = updates.map((u) => u.id);
  check(
    "move down swaps with the previous layer, keys re-minted in order",
    JSON.stringify(reordered) === JSON.stringify(["a", "c", "b"]) &&
      updates.every(
        (u, i) => i === 0 || updates[i - 1].layerIndex < u.layerIndex
      )
  );
  check(
    "move down at the bottom is a no-op",
    buildReorderUpdates(rows, "a", "down").length === 0
  );
  check(
    "move up at the top is a no-op",
    buildReorderUpdates(rows, "c", "up").length === 0
  );
}

// ---------------------------------------------------------------------------
if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll layer-stacking replay checks passed.");
