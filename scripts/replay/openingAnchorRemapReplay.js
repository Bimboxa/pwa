// Node replay of the glued-opening anchor remap (vertex fork / snap-replace)
// and of the ref remap helper coverage relied on by duplicateAndMovePoint.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/openingAnchorRemapReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/openingAnchorRemapReplay.mjs && node /tmp/openingAnchorRemapReplay.mjs
//
// Scenarios: anchor start/end/arc-control id swaps, untouched-rel null,
// soft-deleted rel skip, and remapPointIds rewriting contour refs +
// segment-flag id arrays + guideLine pointId refs. Exits 1 on any failure.

import computeOpeningAnchorRemap from "Features/annotations/utils/computeOpeningAnchorRemap";
import { remapPointIds } from "Features/annotations/utils/remapAnnotationRefs";

let failures = 0;

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- computeOpeningAnchorRemap ---

console.log("computeOpeningAnchorRemap");

const rel = {
  id: "rel1",
  hostAnnotationId: "host1",
  openingAnnotationId: "op1",
  hostSegmentStartPointId: "pA",
  hostSegmentEndPointId: "pB",
  hostArcControlPointId: null,
  hostDistanceM: 1.35,
};

check(
  "end-id swap only touches the matched field",
  JSON.stringify(computeOpeningAnchorRemap(rel, { pB: "pB2" })) ===
    JSON.stringify({ hostSegmentEndPointId: "pB2" })
);

check(
  "start-id swap",
  computeOpeningAnchorRemap(rel, { pA: "pA2" })?.hostSegmentStartPointId ===
    "pA2"
);

const arcRel = { ...rel, hostArcControlPointId: "pC" };
const arcChanges = computeOpeningAnchorRemap(arcRel, { pC: "pC2", pA: "pA2" });
check(
  "arc-control + start swap together",
  arcChanges?.hostArcControlPointId === "pC2" &&
    arcChanges?.hostSegmentStartPointId === "pA2" &&
    arcChanges?.hostSegmentEndPointId === undefined
);

check(
  "no matching id -> null",
  computeOpeningAnchorRemap(rel, { pZ: "pZ2" }) === null
);

check(
  "soft-deleted rel -> null",
  computeOpeningAnchorRemap({ ...rel, deletedAt: "2026-08-29" }, { pB: "pB2" }) ===
    null
);

check("null rel -> null", computeOpeningAnchorRemap(null, { pB: "pB2" }) === null);

// --- remapPointIds coverage used by duplicateAndMovePoint ---

console.log("remapPointIds (fork ref coverage)");

const annotation = {
  id: "host1",
  points: [
    { id: "pA", type: "square" },
    { id: "pB", type: "square" },
    { id: "pC", type: "circle" },
  ],
  cuts: [
    {
      id: "cut1",
      points: [{ id: "pB" }, { id: "pD" }],
      hiddenSegmentsPointIds: ["pB"],
    },
  ],
  hiddenSegmentsPointIds: ["pB", "pA"],
  guideLines: [{ points: [{ pointId: "pB" }, { pointId: "pD" }] }],
};

const remapped = { ...annotation };
remapPointIds(remapped, { pB: "pB2" });

check(
  "contour ref swapped, type preserved",
  remapped.points[1].id === "pB2" && remapped.points[1].type === "square"
);
check(
  "other contour refs untouched",
  remapped.points[0].id === "pA" && remapped.points[2].id === "pC"
);
check("cut ring ref swapped", remapped.cuts[0].points[0].id === "pB2");
check(
  "cut-level segment flag id swapped",
  remapped.cuts[0].hiddenSegmentsPointIds[0] === "pB2"
);
check(
  "root segment flag ids swapped",
  remapped.hiddenSegmentsPointIds[0] === "pB2" &&
    remapped.hiddenSegmentsPointIds[1] === "pA"
);
check(
  "guideLine pointId ref swapped",
  remapped.guideLines[0].points[0].pointId === "pB2" &&
    remapped.guideLines[0].points[1].pointId === "pD"
);
check(
  "source annotation left untouched",
  annotation.points[1].id === "pB" &&
    annotation.hiddenSegmentsPointIds[0] === "pB"
);

// --- summary ---

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall checks passed");
