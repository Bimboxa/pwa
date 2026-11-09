// Node test of resolveAnnotationRowForBuild (bundled: resolvePoints imports
// through the Features alias).
//
//   npx esbuild src/Features/annotations/utils/__test__resolveAnnotationRowForBuild.mjs \
//     --bundle --format=esm --platform=node --alias:Features=./src/Features \
//     --outfile=/tmp/__test__resolveAnnotationRowForBuild.mjs && node /tmp/__test__resolveAnnotationRowForBuild.mjs

import resolveAnnotationRowForBuild from "./resolveAnnotationRowForBuild.js";

let passed = 0;
let failed = 0;
const check = (label, condition, detail) => {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL ${label}`, detail ?? "");
  }
};

const imageSize = { width: 1000, height: 500 };
const pointsIndex = {
  a: { x: 0.1, y: 0.2 },
  b: { x: 0.5, y: 0.2 },
  c: { x: 0.5, y: 0.6 },
  d: { x: 0.1, y: 0.6 },
  h1: { x: 0.2, y: 0.3 },
  h2: { x: 0.3, y: 0.3 },
  h3: { x: 0.3, y: 0.4 },
  p1: { x: 0.7, y: 0.9 },
  p2: { x: 0.8, y: 0.9 },
};

const row = {
  id: "ann1",
  type: "POLYGON",
  points: [{ id: "a" }, { id: "b", isBreak: true }, { id: "c" }, { id: "d" }],
  hiddenSegmentsPointIds: ["d"],
  isFlatExtrusionSegmentsPointIds: ["a", "c"],
  cuts: [{ id: "cut1", points: [{ id: "h1" }, { id: "h2" }, { id: "h3" }], hiddenSegmentsPointIds: ["h3"] }],
  profileLines: [
    { points: [{ pointId: "p1", type: "square", height: 0 }, { pointId: "p2", type: "circle", height: 0.5 }], mirror: true },
  ],
  height: 2,
  offsetZ: -1,
};

const resolved = resolveAnnotationRowForBuild({ row, pointsIndex, imageSize });
check("points in px, flags kept", resolved.points.length === 4 && resolved.points[0].x === 100
  && resolved.points[0].y === 100 && resolved.points[1].isBreak === true && resolved.points[1].type === "square");
check("hidden segment index (closed ring, start point d → 3)", resolved.hiddenSegmentsIdx.join() === "3"
  && resolved.hiddenSegmentsPointIds.join() === "d");
check("flat extrusion indices", resolved.isFlatExtrusionSegmentsIdx.join() === "0,2");
check("cut resolved with its flags", resolved.cuts.length === 1 && resolved.cuts[0].points[0].x === 200
  && resolved.cuts[0].hiddenSegmentsIdx.join() === "2");
check("profile line resolved with heights and types",
  resolved.profileLines[0].points.length === 2 && resolved.profileLines[0].points[1].x === 800
  && resolved.profileLines[0].points[1].height === 0.5 && resolved.profileLines[0].points[1].type === "circle"
  && resolved.profileLines[0].mirror === true);
check("row fields kept", resolved.height === 2 && resolved.offsetZ === -1 && resolved.id === "ann1");
check("row untouched", row.points[0].x === undefined);

check("missing points → null", resolveAnnotationRowForBuild({
  row: { points: [{ id: "zz" }, { id: "yy" }] }, pointsIndex, imageSize }) === null);
check("open polyline: last segment index not a segment", resolveAnnotationRowForBuild({
  row: { type: "POLYLINE", points: [{ id: "a" }, { id: "b" }, { id: "c" }], hiddenSegmentsPointIds: ["c"] },
  pointsIndex, imageSize }).hiddenSegmentsIdx.length === 0);
check("orphan ref dropped", resolveAnnotationRowForBuild({
  row: { type: "POLYLINE", points: [{ id: "a" }, { id: "zz" }, { id: "c" }] }, pointsIndex, imageSize })
  .points.length === 2);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
