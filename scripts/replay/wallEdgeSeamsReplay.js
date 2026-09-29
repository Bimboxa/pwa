// Node replay of the 3D wall edge lines on curved (S-C-S arc) POLYLINE walls:
// a CM-width wall (extrudeClosedShape over the offset rect ring) must draw the
// same outline as a PX-width wall (extrudePolylineWall) — arc facet seams are
// suppressed by the WALL_PLANAR rule (15° dihedral threshold) instead of the
// EdgesGeometry 1° default that drew a vertical line at every facet.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/wallEdgeSeamsReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/wallEdgeSeamsReplay.mjs && node /tmp/wallEdgeSeamsReplay.mjs
//
// Exits 1 on any failure.

/* global process */

import { MeshLambertMaterial } from "three";

import {
  expandArcsInPath,
  expandRingWithOffsets,
} from "Features/geometry/utils/arcSampling";
import wallToRectRing, {
  wallToHollowRings,
} from "Features/geometry/utils/wallToRectRing";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import extrudeClosedShape from "Features/threedEditor/js/utilsAnnotationsManager/extrudeClosedShape";
import extrudePolylineWall from "Features/threedEditor/js/utilsAnnotationsManager/extrudePolylineWall";

let failures = 0;

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// Same metrics as the example base map (A3 page, 2480×1754 px).
const BASE_MAP = {
  imageWidth: 2480,
  imageHeight: 1754,
  meterByPx: 0.00029479188037412666,
};
const HEIGHT = 1;
const STROKE_WIDTH_CM = 2;
const HALF_WIDTH_PX = STROKE_WIDTH_CM / (BASE_MAP.meterByPx * 100) / 2;

const toLocal = (p) => ({ ...pixelToWorld(p, BASE_MAP), type: p.type });

function findGridEdges(object) {
  let found = null;
  object.traverse((c) => {
    if (!found && c.userData?.isGridEdge) found = c;
  });
  return found;
}

// Count the segments standing along Z (wall corners / facet seams).
function countVerticalSegments(lines) {
  const pos = lines.geometry.getAttribute("position").array;
  let count = 0;
  for (let i = 0; i + 5 < pos.length; i += 6) {
    const dx = Math.abs(pos[i + 3] - pos[i]);
    const dy = Math.abs(pos[i + 4] - pos[i + 1]);
    const dz = Math.abs(pos[i + 5] - pos[i + 2]);
    if (dx < 1e-6 && dy < 1e-6 && dz > 0.5) count++;
  }
  return count;
}

function buildCmWall(points, { wallEdges }) {
  const expanded = expandArcsInPath(points, 6, false);
  const ring = wallToRectRing(expanded, HALF_WIDTH_PX).slice(0, -1);
  const local = ring.map(([x, y]) => toLocal({ x, y }));
  return extrudeClosedShape(
    local,
    HEIGHT,
    new MeshLambertMaterial(),
    undefined,
    0,
    [],
    wallEdges ? { wallEdges: true } : {}
  );
}

function buildCmClosedWall(points, { wallEdges }) {
  const expanded = expandArcsInPath(points, 6, true);
  const rings = wallToHollowRings(expanded, HALF_WIDTH_PX);
  return extrudeClosedShape(
    rings.outer.map(toLocal),
    HEIGHT,
    new MeshLambertMaterial(),
    [rings.inner.map(toLocal)],
    0,
    [],
    wallEdges ? { wallEdges: true } : {}
  );
}

function buildPxWall(points) {
  const expanded = expandRingWithOffsets(points, 6, false);
  return extrudePolylineWall(
    expanded.map(toLocal),
    HEIGHT,
    new MeshLambertMaterial(),
    false,
    0,
    null
  );
}

function runOpenCase(label, points, { assertAfter }) {
  console.log(`\n${label}`);
  const before = findGridEdges(buildCmWall(points, { wallEdges: false }));
  const after = findGridEdges(buildCmWall(points, { wallEdges: true }));
  const px = findGridEdges(buildPxWall(points));
  const nBefore = countVerticalSegments(before);
  const nAfter = countVerticalSegments(after);
  const nPx = countVerticalSegments(px);
  console.log(
    `  vertical segments: CM before=${nBefore}, CM after=${nAfter}, PX=${nPx}`
  );
  check(
    "CM after is tagged WALL_PLANAR",
    after.userData.gridEdgeKind === "WALL_PLANAR"
  );
  check("CM after carries sourceMesh", !!after.userData.sourceMesh?.isMesh);
  check(
    "CM before is tagged EDGES (unchanged default)",
    before.userData.gridEdgeKind === "EDGES"
  );
  check(
    "PX wall is tagged WALL_PLANAR",
    px.userData.gridEdgeKind === "WALL_PLANAR"
  );
  if (assertAfter != null) {
    check(
      `CM after draws only the end-cap corners (${assertAfter})`,
      nAfter === assertAfter,
      `got ${nAfter}`
    );
    check(
      "CM before drew every facet seam",
      nBefore > assertAfter,
      `got ${nBefore}`
    );
  }
}

// Case A: the CM example annotation from the report (arc ≈ 45°-ish sweep).
runOpenCase(
  "Case A — example CM arc polyline",
  [
    { x: 458.167, y: 1087.458, type: "square" },
    { x: 803.81, y: 615.833, type: "circle" },
    { x: 1310.968, y: 464.009, type: "square" },
  ],
  { assertAfter: 4 }
);

// Case B: 180° arc → 15.0° facets, exactly at the seam threshold. Reported
// only (parity with PX, whose sampling is identical).
runOpenCase(
  "Case B — 180° arc (facets at the 15° threshold, report only)",
  [
    { x: 800, y: 1000, type: "square" },
    { x: 1200, y: 600, type: "circle" },
    { x: 1600, y: 1000, type: "square" },
  ],
  { assertAfter: null }
);

// Case C: closed S-C-S ring (two ~147° arcs → ~12° facets, under the seam
// threshold) → hollow ring wall (outer + inner loop). No end caps: the only
// vertical edges left are the two real corners where the arcs meet (lens
// shape), on the outer AND the inner loop → 4.
{
  console.log("\nCase C — closed arc ring (hollow wall, hole loop)");
  const ring = [
    { x: 800, y: 1000, type: "square" },
    { x: 1200, y: 700, type: "circle" },
    { x: 1600, y: 1000, type: "square" },
    { x: 1200, y: 1300, type: "circle" },
  ];
  const before = findGridEdges(buildCmClosedWall(ring, { wallEdges: false }));
  const after = findGridEdges(buildCmClosedWall(ring, { wallEdges: true }));
  const nBefore = countVerticalSegments(before);
  const nAfter = countVerticalSegments(after);
  console.log(`  vertical segments: CM before=${nBefore}, CM after=${nAfter}`);
  check(
    "closed CM ring after keeps only the 2 arc-junction corners (4)",
    nAfter === 4,
    `got ${nAfter}`
  );
  check(
    "closed CM ring before drew facet seams",
    nBefore > 0,
    `got ${nBefore}`
  );
  const pos = after.geometry.getAttribute("position").array;
  check("closed CM ring after still has outline segments", pos.length >= 6 * 8);
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
