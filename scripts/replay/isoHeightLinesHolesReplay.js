// Node replay of a POLYGON folded on an isoHeightLine (two-slope roof: ridge
// chord at 1 m, eaves at 0) carrying cuts / a contour notch: the sloped faces
// must be kept and simply opened, the opening projecting exactly on the drawn
// cut (hole inside one slope, hole astride the ridge, notch through the ridge).
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/isoHeightLinesHolesReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/isoHeightLinesHolesReplay.mjs && node /tmp/isoHeightLinesHolesReplay.mjs
//
// Exits 1 on any failure.

/* global process */

import triangulateAnnotationGeometry from "Features/geometry/utils/triangulateAnnotationGeometry";
import getIsoSurfaceOffsetsSampler from "Features/annotations/utils/getIsoSurfaceOffsetsSampler";
import applyNotchSegmentsToRing from "Features/annotations/utils/applyNotchSegmentsToRing";

let failures = 0;
function check(label, ok, detail = "") {
  if (ok) {
    console.log(`ok   - ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL - ${label}${detail ? ` (${detail})` : ""}`);
  }
}
const close = (a, b, tol) => Math.abs(a - b) <= tol;

// Roof 10 x 6, ridge along y at x = 5, height 1 → z = 1 - |x - 5| / 5.
const W = 10;
const D = 6;
const RIDGE = 5;
const zRoof = (x) => 1 - Math.abs(x - RIDGE) / RIDGE;
const SLOPE_FACTOR = Math.hypot(RIDGE, 1) / RIDGE; // developed / planar

const pt = (x, y) => ({ x, y, type: "square", offsetBottom: 0, offsetTop: 0 });
const rect = (x0, y0, x1, y1) => [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)];
const ringArea = (ring) => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
};
const inRect = (p, r) => p.x > r[0] && p.x < r[2] && p.y > r[1] && p.y < r[3];

const isoChords = [
  {
    polyline: [
      { x: RIDGE, y: 0 },
      { x: RIDGE, y: D },
    ],
    height: 1,
  },
];

function run(label, { contour, holes = [], voids = [], height = 0 }) {
  const tri = triangulateAnnotationGeometry({
    contour,
    holes,
    height,
    verticalLift: 0,
    unitScale: 1,
    zFightOffset: 0,
    isoPartition: { isoChords },
  });
  const { positions, indices, topRange, sideRange } = tri;

  check(`${label}: iso partition applied`, tri.isoPartitionApplied === true);

  // Every top vertex on the roof, no top triangle inside a void.
  let worst = 0;
  let triInVoid = false;
  for (let i = topRange[0]; i < topRange[0] + topRange[1]; i += 3) {
    let cx = 0;
    let cy = 0;
    for (let k = 0; k < 3; k++) {
      const v = indices[i + k];
      const x = positions[v * 3];
      const y = positions[v * 3 + 1];
      const z = positions[v * 3 + 2];
      worst = Math.max(worst, Math.abs(z - (height + zRoof(x))));
      cx += x / 3;
      cy += y / 3;
    }
    if (voids.some((r) => inRect({ x: cx, y: cy }, r))) triInVoid = true;
  }
  check(`${label}: top vertices on the roof planes`, worst < 1e-5, `${worst}`);
  check(`${label}: no top triangle inside an opening`, !triInVoid);

  const planar =
    ringArea(contour) - holes.reduce((s, h) => s + ringArea(h), 0);
  check(
    `${label}: areaPlanar = contour - cuts`,
    close(tri.areaPlanar, planar, 1e-6),
    `${tri.areaPlanar} vs ${planar}`
  );
  check(
    `${label}: areaTop = developed roof area`,
    close(tri.areaTop, planar * SLOPE_FACTOR, 1e-4),
    `${tri.areaTop} vs ${planar * SLOPE_FACTOR}`
  );

  if (height > 0) {
    // Wall vertices: bottom at 0, top on the roof.
    let wallWorst = 0;
    for (let i = sideRange[0]; i < sideRange[0] + sideRange[1]; i++) {
      const v = indices[i];
      const x = positions[v * 3];
      const z = positions[v * 3 + 2];
      wallWorst = Math.max(
        wallWorst,
        Math.min(Math.abs(z), Math.abs(z - (height + zRoof(x))))
      );
    }
    check(
      `${label}: wall vertices at the base or on the roof`,
      wallWorst < 1e-5,
      `${wallWorst}`
    );
  }
  return tri;
}

const roof = rect(0, 0, W, D);

// (a) hole inside one slope
run("hole in one slope", {
  contour: roof,
  holes: [rect(1, 2, 3, 4)],
  voids: [[1, 2, 3, 4]],
});

// (b) hole astride the ridge
run("hole astride the ridge", {
  contour: roof,
  holes: [rect(4, 2, 7, 4)],
  voids: [[4, 2, 7, 4]],
});

// (b') same, reversed hole winding + two holes
run("two holes, mixed windings", {
  contour: roof,
  holes: [rect(4, 2, 7, 4).reverse(), rect(1, 1, 2, 5)],
  voids: [
    [4, 2, 7, 4],
    [1, 1, 2, 5],
  ],
});

// (c) notch through the ridge: contour vertices carry the sampled heights
// written by the "Evider" commit (getIsoSurfaceOffsetsSampler).
const sampler = getIsoSurfaceOffsetsSampler({
  points: roof,
  isoHeightLines: [{ points: isoChords[0].polyline, height: 1 }],
});
check("surface sampler available", typeof sampler === "function");
check(
  "surface sampler on the slope",
  close(sampler({ x: 4, y: 1 }).offsetTop, zRoof(4), 1e-9)
);
const withHeight = (x, y) => ({ ...pt(x, y), ...sampler({ x, y }) });
const notched = [
  pt(0, 0),
  withHeight(4, 0),
  withHeight(4, 1.5),
  withHeight(6, 1.5),
  withHeight(6, 0),
  pt(W, 0),
  pt(W, D),
  pt(0, D),
];
run("notch through the ridge", {
  contour: notched,
  voids: [[4, 0, 6, 1.5]],
});
run("notch + hole astride the ridge", {
  contour: notched,
  holes: [rect(4.5, 3, 6.5, 5)],
  voids: [
    [4, 0, 6, 1.5],
    [4.5, 3, 6.5, 5],
  ],
});

// (d) extruded slab
run("extruded, hole astride the ridge", {
  contour: roof,
  holes: [rect(4, 2, 7, 4)],
  voids: [[4, 2, 7, 4]],
  height: 0.2,
});

// (e) "Bord d'ouverture" segments: notch vertices stored at offsetTop 0 are
// put back on the sheet at resolve time (applyNotchSegmentsToRing), as if the
// notch outline were replaced by a straight segment, then opened.
const flatNotched = [
  pt(0, 0),
  pt(W, 0),
  pt(W, 2),
  pt(7, 2),
  pt(7, 4),
  pt(W, 4),
  pt(W, D),
  pt(0, D),
];
const isoHeightLines = [{ points: isoChords[0].polyline, height: 1 }];
const resolvedRing = applyNotchSegmentsToRing({
  points: flatNotched,
  notchSegmentsIdx: [2, 3, 4],
  isoHeightLines,
});
check(
  "notch flag: inner vertices on the sheet",
  close(resolvedRing[3].offsetTop, zRoof(7), 1e-9) &&
    close(resolvedRing[4].offsetTop, zRoof(7), 1e-9),
  `${resolvedRing[3].offsetTop}`
);
check(
  "notch flag: run ends keep their own height",
  resolvedRing[2] === flatNotched[2] && resolvedRing[5] === flatNotched[5]
);
check(
  "notch flag: no flag keeps the ring reference",
  applyNotchSegmentsToRing({
    points: flatNotched,
    notchSegmentsIdx: [],
    isoHeightLines,
  }) === flatNotched
);
run("notch flag + hole in the other slope", {
  contour: resolvedRing,
  holes: [rect(1, 2, 3, 4)],
  voids: [
    [7, 2, W, 4],
    [1, 2, 3, 4],
  ],
});

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall good");
