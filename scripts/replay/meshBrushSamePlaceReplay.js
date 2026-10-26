// Node replay of the « Pinceau » duplicate guard (findSamePlaceAnnotation):
// a 2D annotation the brush would create is refused when a live annotation
// of the same template and type already sits at the same place — the
// « Détection des doublons » criterion (shared length for lines, intersection
// area for polygons, default tolerance).
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/meshBrushSamePlaceReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/meshBrushSamePlaceReplay.mjs && node /tmp/meshBrushSamePlaceReplay.mjs
//
// Exits 1 on any failure.

/* global process */

import findSamePlaceAnnotation from "Features/meshPaint/utils/findSamePlaceAnnotation";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(
    `${ok ? "ok  " : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`
  );
  if (!ok) failures += 1;
};
const meterByPx = 0.01; // 1 cm / px → threshold 2 px, min overlap 10 px
const T = "tpl";
const line = (id, pts, over = {}) => ({
  id,
  type: "POLYLINE",
  annotationTemplateId: T,
  closeLine: false,
  points: pts.map(([x, y]) => ({ x, y, type: "square" })),
  cuts: [],
  ...over,
});
const poly = (id, pts, over = {}) => ({
  id,
  type: "POLYGON",
  annotationTemplateId: T,
  points: pts.map(([x, y]) => ({ x, y, type: "square" })),
  cuts: [],
  ...over,
});
const existing = [
  line("L1", [
    [0, 100],
    [400, 100],
  ]),
  poly("P1", [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
  ]),
  line(
    "L2",
    [
      [0, 500],
      [400, 500],
    ],
    { annotationTemplateId: "other" }
  ),
];
const r = (candidate) =>
  findSamePlaceAnnotation({ candidate, annotations: existing, meterByPx });

check(
  "same line → L1",
  r(
    line(null, [
      [0, 100],
      [400, 100],
    ])
  ) === "L1"
);
check(
  "partial run along L1 → L1",
  r(
    line(null, [
      [100, 101],
      [300, 101],
    ])
  ) === "L1"
);
check(
  "parallel line 50 px away → null",
  r(
    line(null, [
      [0, 150],
      [400, 150],
    ])
  ) === null
);
check(
  "crossing line → null",
  r(
    line(null, [
      [200, 0],
      [200, 300],
    ])
  ) === null
);
check(
  "same template line on other's place → null",
  r(
    line(null, [
      [0, 500],
      [400, 500],
    ])
  ) === null
);
check(
  "other type (POLYGON) along L1, clear of P1 → null",
  r(
    poly(null, [
      [250, 100],
      [400, 100],
      [400, 110],
    ])
  ) === null
);
check(
  "same polygon → P1",
  r(
    poly(null, [
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
    ])
  ) === "P1"
);
check(
  "polygon mostly over P1 → P1",
  r(
    poly(null, [
      [50, 50],
      [250, 50],
      [250, 250],
      [50, 250],
    ])
  ) === "P1"
);
check(
  "neighbour polygon sharing a side → null",
  r(
    poly(null, [
      [200, 0],
      [400, 0],
      [400, 200],
      [200, 200],
    ])
  ) === null
);
check(
  "no template → null",
  r(
    line(
      null,
      [
        [0, 100],
        [400, 100],
      ],
      { annotationTemplateId: null }
    )
  ) === null
);
check(
  "px fallback (no scale) same line → L1",
  findSamePlaceAnnotation({
    candidate: line(null, [
      [0, 100],
      [400, 100],
    ]),
    annotations: existing,
    meterByPx: null,
  }) === "L1"
);
if (failures) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log("all good");
