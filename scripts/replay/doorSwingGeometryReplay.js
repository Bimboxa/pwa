// Node replay of the door swing symbol geometry (OPENING annotations of type
// DOOR): hinge end × swing side on a horizontal and an oblique wall segment.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/doorSwingGeometryReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/doorSwingGeometryReplay.mjs && node /tmp/doorSwingGeometryReplay.mjs
//
// Exits 1 on any failure.

import getDoorSwingGeometry from "Features/annotations/utils/getDoorSwingGeometry";

let failures = 0;

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const samePt = (p, x, y) => near(p.x, x) && near(p.y, y);
const fmt = (p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;

// --- Horizontal wall p1=(0,0) p2=(100,0), thickness 20 ---

console.log("horizontal wall");

{
  const base = { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, bandWidth: 20 };

  // START hinge, side +1 (left normal of →x is +y on screen = downwards)
  const g = getDoorSwingGeometry({ ...base, doorHinge: "START", doorSide: 1 });
  check(
    "START/+1 leafStart on the +y wall face",
    samePt(g.leafStart, 0, 10),
    fmt(g.leafStart)
  );
  check(
    "START/+1 leafEnd = leafStart + L along +y",
    samePt(g.leafEnd, 0, 110),
    fmt(g.leafEnd)
  );
  check(
    "START/+1 arcEnd on the opposite jamb face",
    samePt(g.arcEnd, 100, 10),
    fmt(g.arcEnd)
  );
  check("START/+1 radius = opening length", near(g.radius, 100));
  // from angle +90° (leaf tip) to 0° (jamb): decreasing angle → sweep 0
  check("START/+1 sweep flag 0", g.sweepFlag === 0, String(g.sweepFlag));

  // START hinge, side -1 → mirror across the wall
  const m = getDoorSwingGeometry({ ...base, doorHinge: "START", doorSide: -1 });
  check(
    "START/-1 leafStart mirrored",
    samePt(m.leafStart, 0, -10),
    fmt(m.leafStart)
  );
  check(
    "START/-1 leafEnd mirrored",
    samePt(m.leafEnd, 0, -110),
    fmt(m.leafEnd)
  );
  check("START/-1 arcEnd mirrored", samePt(m.arcEnd, 100, -10), fmt(m.arcEnd));
  check(
    "START/-1 sweep flag flips to 1",
    m.sweepFlag === 1,
    String(m.sweepFlag)
  );

  // END hinge, side +1 → hinge on p2
  const e = getDoorSwingGeometry({ ...base, doorHinge: "END", doorSide: 1 });
  check("END/+1 hinge is p2", samePt(e.hinge, 100, 0), fmt(e.hinge));
  check(
    "END/+1 leafStart on p2 face",
    samePt(e.leafStart, 100, 10),
    fmt(e.leafStart)
  );
  check("END/+1 leafEnd along +y", samePt(e.leafEnd, 100, 110), fmt(e.leafEnd));
  check("END/+1 arcEnd on p1 face", samePt(e.arcEnd, 0, 10), fmt(e.arcEnd));
  // from +90° (leaf tip) to 180° (jamb at -x): increasing angle → sweep 1
  check("END/+1 sweep flag 1", e.sweepFlag === 1, String(e.sweepFlag));

  const e2 = getDoorSwingGeometry({ ...base, doorHinge: "END", doorSide: -1 });
  check("END/-1 sweep flag 0", e2.sweepFlag === 0, String(e2.sweepFlag));
  check(
    "END/-1 leafEnd mirrored",
    samePt(e2.leafEnd, 100, -110),
    fmt(e2.leafEnd)
  );
}

// --- Oblique wall (45°), zero thickness: leaf starts on the centerline ---

console.log("oblique wall");

{
  const L = Math.hypot(30, 30);
  const g = getDoorSwingGeometry({
    p1: { x: 10, y: 10 },
    p2: { x: 40, y: 40 },
    bandWidth: 0,
    doorHinge: "START",
    doorSide: 1,
  });
  const s2 = Math.SQRT1_2;
  check(
    "oblique leafStart = hinge (no thickness)",
    samePt(g.leafStart, 10, 10),
    fmt(g.leafStart)
  );
  check(
    "oblique leafEnd = hinge + L·n, n = left normal (-uy, ux)",
    samePt(g.leafEnd, 10 - L * s2, 10 + L * s2),
    fmt(g.leafEnd)
  );
  check("oblique arcEnd = p2", samePt(g.arcEnd, 40, 40), fmt(g.arcEnd));
  check(
    "oblique leaf ⟂ wall",
    near(
      (g.leafEnd.x - g.leafStart.x) * 30 + (g.leafEnd.y - g.leafStart.y) * 30,
      0
    )
  );
  check(
    "oblique |leaf| = L",
    near(
      Math.hypot(g.leafEnd.x - g.leafStart.x, g.leafEnd.y - g.leafStart.y),
      L
    )
  );
  check(
    "oblique |arcEnd - center| = L",
    near(Math.hypot(g.arcEnd.x - g.leafStart.x, g.arcEnd.y - g.leafStart.y), L)
  );
  check(
    "oblique START/+1 sweep flag 0",
    g.sweepFlag === 0,
    String(g.sweepFlag)
  );
}

// --- Degenerate ---

console.log("degenerate");
check(
  "null on coincident endpoints",
  getDoorSwingGeometry({ p1: { x: 1, y: 1 }, p2: { x: 1, y: 1 } }) === null
);
check(
  "null on missing points",
  getDoorSwingGeometry({ p1: null, p2: { x: 1, y: 1 } }) === null
);
check(
  "unknown side falls back to +1",
  getDoorSwingGeometry({
    p1: { x: 0, y: 0 },
    p2: { x: 10, y: 0 },
    doorSide: "x",
  }).leafEnd.y > 0
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
