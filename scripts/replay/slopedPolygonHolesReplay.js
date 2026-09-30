// Node replay of a sloped POLYGON (per-vertex offsetTop ramp) carrying a cut:
// the top face must stay on the ramp plane and the cut must read as a vertical
// cliff in it (hole rim draped on the contour sheet), instead of the sheet
// being pulled down to the base height around the hole.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/slopedPolygonHolesReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/slopedPolygonHolesReplay.mjs && node /tmp/slopedPolygonHolesReplay.mjs
//
// Exits 1 on any failure.

/* global process */

import triangulateAnnotationGeometry from "Features/geometry/utils/triangulateAnnotationGeometry";
import drapeHoleRingsOnContour from "Features/geometry/utils/drapeHoleRingsOnContour";

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

// User's example ("Couverture nervurée"): rectangle, the two x=1203.17
// vertices at offsetTop 1 → ramp along x. Cut inside, no offsets.
const X0 = 349.396;
const X1 = 1203.17;
const Y0 = 585.227;
const Y1 = 931.48;
const HEIGHT = 0.2;
const zRamp = (x) => (x - X0) / (X1 - X0);

const pt = (x, y, offsetTop = 0, offsetBottom = 0) => ({
  x,
  y,
  type: "square",
  offsetBottom,
  offsetTop,
});
const contour = [pt(X0, Y0, 0), pt(X1, Y0, 1), pt(X1, Y1, 1), pt(X0, Y1, 0)];
const HX0 = 577.354;
const HX1 = 930.257;
const HY0 = 677;
const HY1 = 837.012;
const hole = [pt(HX0, HY0), pt(HX1, HY0), pt(HX1, HY1), pt(HX0, HY1)];

// --- 1. drape helper alone
const draped = drapeHoleRingsOnContour(contour, [hole]);
check(
  "drape returns a new holes array",
  draped !== undefined && draped[0] !== hole
);
check(
  "input hole vertices are not mutated",
  hole.every((p) => p.offsetTop === 0)
);
check(
  "draped offsetTop at the low rim ≈ 0.267",
  close(draped[0][0].offsetTop, zRamp(HX0), 1e-3),
  `${draped[0][0].offsetTop}`
);
check(
  "draped offsetTop at the high rim ≈ 0.680",
  close(draped[0][1].offsetTop, zRamp(HX1), 1e-3),
  `${draped[0][1].offsetTop}`
);
check(
  "draped offsetBottom stays 0",
  draped[0].every((p) => close(p.offsetBottom, 0, 1e-12))
);

// Authored offsets on the hole ring → untouched (same reference).
const authored = [pt(HX0, HY0, 0.05), pt(HX1, HY0), pt(HX1, HY1), pt(HX0, HY1)];
const keep = drapeHoleRingsOnContour(contour, [authored]);
check(
  "hole ring with an authored offset is returned by reference",
  keep[0] === authored
);

// Contour without offsets → fast path, same holes array reference.
const flatContour = [pt(X0, Y0), pt(X1, Y0), pt(X1, Y1), pt(X0, Y1)];
const flatHoles = [hole];
check(
  "flat contour keeps the holes array reference",
  drapeHoleRingsOnContour(flatContour, flatHoles) === flatHoles
);

// --- 2. full triangulation: every top vertex on the ramp plane
function runAndCheck(label, ring, holeRing, flipY) {
  const f = (p) => (flipY ? { ...p, y: -p.y } : p);
  const tri = triangulateAnnotationGeometry({
    contour: ring.map(f),
    holes: [holeRing.map(f)],
    height: HEIGHT,
    verticalLift: 0,
    unitScale: 1,
    zFightOffset: 0,
  });
  const { positions, indices, topRange } = tri;
  // Top face vertices.
  let topOk = true;
  let worst = 0;
  const seen = new Set();
  for (let i = topRange[0]; i < topRange[0] + topRange[1]; i++) {
    const vi = indices[i];
    if (seen.has(vi)) continue;
    seen.add(vi);
    const x = positions[vi * 3];
    const z = positions[vi * 3 + 2];
    const d = Math.abs(z - (HEIGHT + zRamp(x)));
    if (d > worst) worst = d;
    if (d > 1e-6) topOk = false;
  }
  check(
    `${label}: every top vertex sits on the ramp plane`,
    topOk,
    `worst ${worst}`
  );
  check(`${label}: the top face has triangles`, topRange[1] > 0);

  // Wall vertices: each is either on the bottom (z=0) or on the ramp plane
  // (hole rim included → vertical cliff).
  let wallOk = true;
  const [ws, wc] = tri.sideRange;
  for (let i = ws; i < ws + wc; i++) {
    const vi = indices[i];
    const x = positions[vi * 3];
    const z = positions[vi * 3 + 2];
    const onBottom = Math.abs(z) < 1e-9;
    const onTop = Math.abs(z - (HEIGHT + zRamp(x))) < 1e-6;
    if (!onBottom && !onTop) wallOk = false;
  }
  check(
    `${label}: wall vertices are on the bottom or on the ramp plane`,
    wallOk
  );

  // Quantities: planar area and volume of the slanted prism minus the hole.
  const outerA = (X1 - X0) * (Y1 - Y0);
  const holeA = (HX1 - HX0) * (HY1 - HY0);
  const areaPlanar = outerA - holeA;
  check(
    `${label}: areaPlanar`,
    close(tri.areaPlanar, areaPlanar, areaPlanar * 1e-9),
    `${tri.areaPlanar} vs ${areaPlanar}`
  );
  // z is linear in x → volume = ∫ (HEIGHT + zRamp(x)) dA = areaPlanar * (HEIGHT + zRamp(xc)).
  const xc =
    ((outerA * (X0 + X1)) / 2 - (holeA * (HX0 + HX1)) / 2) / areaPlanar;
  const volume = areaPlanar * (HEIGHT + zRamp(xc));
  check(
    `${label}: volume = planar area × mean span`,
    close(tri.volume, volume, volume * 1e-9),
    `${tri.volume} vs ${volume}`
  );
  return tri;
}

runAndCheck("px frame", contour, hole, false);
runAndCheck("Y-flipped frame (3D local winding)", contour, hole, true);

// Authored rim offset → that rim vertex stays at HEIGHT + 0.05.
{
  const tri = triangulateAnnotationGeometry({
    contour,
    holes: [authored],
    height: HEIGHT,
    verticalLift: 0,
    unitScale: 1,
    zFightOffset: 0,
  });
  const vi = contour.length; // first hole vertex in the flatPts layout
  const z = tri.positions[vi * 3 + 2];
  check(
    "authored rim vertex keeps its own height",
    close(z, HEIGHT + 0.05, 1e-9),
    `${z}`
  );
}

// Quantities call (height 0): developed top area of the planar ramp.
{
  const tri = triangulateAnnotationGeometry({
    contour,
    holes: [hole],
    height: 0,
    verticalLift: 0,
    unitScale: 1,
    zFightOffset: 0,
  });
  const areaPlanar = (X1 - X0) * (Y1 - Y0) - (HX1 - HX0) * (HY1 - HY0);
  const slope = 1 / (X1 - X0);
  const developed = areaPlanar * Math.sqrt(1 + slope * slope);
  check(
    "height 0: developed top area of the planar ramp",
    close(tri.areaTop, developed, developed * 1e-9),
    `${tri.areaTop} vs ${developed}`
  );
}

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall checks passed");
