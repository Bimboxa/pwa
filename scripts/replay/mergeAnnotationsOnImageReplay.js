/* global process */
// Node replay of the "Fusionner" rasterizer (mergeAnnotationsOnImage): the
// drawing functions are run against a recording fake canvas context with the
// wall / partition / door / windows set of the bug report, so the flattened
// geometry can be checked against the on-screen renderers without a browser.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/mergeAnnotationsOnImageReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/mergeAnnotationsOnImageReplay.mjs && node /tmp/mergeAnnotationsOnImageReplay.mjs
//
// Exits 1 on any failure.

import {
  drawAnnotation,
  getAnnotationsBounds,
} from "Features/baseMapEditor/utils/mergeAnnotationsOnImage";
import { sortOpeningsLast } from "Features/annotations/utils/isOpeningAnnotation";

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const near = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

// --- Recording canvas context -------------------------------------------
// Each fill / stroke records the sub-paths traced since the last beginPath
// plus the style in force at that moment.
function makeCtx() {
  const ops = [];
  let subPaths = [];
  let current = null;
  const ctx = {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    _dash: [],
    beginPath() {
      subPaths = [];
      current = null;
    },
    moveTo(x, y) {
      current = { pts: [{ x, y }], closed: false };
      subPaths.push(current);
    },
    lineTo(x, y) {
      if (!current) this.moveTo(x, y);
      else current.pts.push({ x, y });
    },
    closePath() {
      if (current) current.closed = true;
    },
    arc(x, y, r, a0, a1, ccw) {
      ops.push({ op: "arc", cx: x, cy: y, r, a0, a1, ccw, style: snap() });
    },
    strokeRect(x, y, w, h) {
      ops.push({ op: "strokeRect", x, y, w, h, style: snap() });
    },
    fill(rule) {
      ops.push({
        op: "fill",
        rule,
        subPaths: subPaths.map(copy),
        style: snap(),
      });
    },
    stroke() {
      ops.push({ op: "stroke", subPaths: subPaths.map(copy), style: snap() });
    },
    clip(rule) {
      ops.push({ op: "clip", rule, subPaths: subPaths.map(copy) });
    },
    setLineDash(d) {
      this._dash = d;
    },
    save() {
      ops.push({ op: "save" });
    },
    restore() {
      ops.push({ op: "restore" });
    },
    translate(x, y) {
      ops.push({ op: "translate", x, y });
    },
    rotate(a) {
      ops.push({ op: "rotate", a });
    },
    scale() {},
    fillRect() {},
    fillText() {},
    measureText: () => ({ width: 10 }),
    ops,
  };
  const copy = (sp) => ({
    pts: sp.pts.map((p) => ({ ...p })),
    closed: sp.closed,
  });
  const snap = () => ({
    strokeStyle: ctx.strokeStyle,
    fillStyle: ctx.fillStyle,
    lineWidth: ctx.lineWidth,
    lineCap: ctx.lineCap,
    lineJoin: ctx.lineJoin,
    dash: [...ctx._dash],
  });
  return ctx;
}

const sq = (id, x, y) => ({ id, x, y, type: "square" });

// --- Bug-report data (meterByPx 0.0084667 → 20 cm = 23.62 px) ------------
const meterByPx = 0.008466666666666666;
const W20 = 0.2 / meterByPx; // 23.622
const W10 = 0.1 / meterByPx; // 11.811

const wall = {
  id: "wall",
  type: "STRIP",
  drawingShape: "POLYLINE",
  strokeColor: "#757575",
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  strokeOpacity: 0.75,
  strokeType: "SOLID",
  closeLine: true,
  points: [
    sq("a", 385.961, 314.709),
    sq("b", 385.961, 675.112),
    sq("c", 385.961, 1335.851),
    sq("d", 1843.243, 1335.851),
    sq("e", 1843.243, 601.987),
    sq("f", 1561.188, 601.987),
    sq("g", 1561.188, 314.709),
  ],
};
const partition = {
  id: "partition",
  type: "STRIP",
  strokeColor: "#4e342e",
  strokeWidth: 10,
  strokeWidthUnit: "CM",
  strokeOpacity: 0.75,
  strokeType: "SOLID",
  points: [
    sq("b", 385.961, 675.112),
    sq("h", 923.954, 675.112),
    sq("i", 923.954, 314.709),
  ],
};
const door = {
  id: "door",
  type: "POLYLINE",
  drawingShape: "OPENING",
  isOpening: true,
  openingType: "DOOR",
  strokeColor: "#a1887f",
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  strokeOpacity: 0.6,
  doorHinge: "END",
  doorSide: -1,
  points: [sq("d1", 670.627, 1347.662), sq("d2", 776.926, 1347.662)],
};
const windowLeft = {
  id: "windowLeft",
  type: "POLYLINE",
  drawingShape: "OPENING",
  isOpening: true,
  openingType: "WINDOW",
  strokeColor: "#87CEEB",
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  strokeOpacity: 0.5,
  points: [sq("w1", 374.15, 463.571), sq("w2", 374.15, 581.681)],
};

// --- 1. Wall: one-sided closed band ---------------------------------------
console.log("wall (closed STRIP)");
{
  const ctx = makeCtx();
  drawAnnotation(ctx, wall, meterByPx);
  const fills = ctx.ops.filter((o) => o.op === "fill");
  check("one evenodd fill", fills.length === 1 && fills[0].rule === "evenodd");
  const fill = fills[0];
  const all = fill.subPaths.flatMap((sp) => sp.pts);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  check(
    "band offset OUTSIDE the director (x min ≈ 385.96 − 23.62)",
    near(Math.min(...xs), 385.961 - W20, 0.1),
    `min x = ${Math.min(...xs).toFixed(2)}`
  );
  check(
    "band top edge ≈ 314.71 − 23.62",
    near(Math.min(...ys), 314.709 - W20, 0.1),
    `min y = ${Math.min(...ys).toFixed(2)}`
  );
  check("annular ring = outer + hole", fill.subPaths.length === 2);
  check(
    "fill colour = strokeColor @ strokeOpacity",
    fill.style.fillStyle === "rgba(117,117,117,0.75)"
  );
  const thick = ctx.ops.filter(
    (o) => o.op === "stroke" && o.style.lineWidth > 5
  );
  check("no thick centered stroke", thick.length === 0);
  const director = ctx.ops.filter(
    (o) => o.op === "stroke" && o.style.lineWidth === 2
  );
  check(
    "director line 2px closed",
    director.length === 1 && director[0].subPaths[0].closed
  );
  check(
    "no round caps",
    ctx.ops.every((o) => o.op !== "stroke" || o.style.lineCap !== "round")
  );
}

// --- 2. Partition: open band 10 cm ----------------------------------------
console.log("partition (open STRIP)");
{
  const ctx = makeCtx();
  drawAnnotation(ctx, partition, meterByPx);
  const fill = ctx.ops.find((o) => o.op === "fill");
  check("band fill present", Boolean(fill));
  const pts = fill.subPaths[0].pts;
  const xs = pts.map((p) => p.x);
  // L-shape: horizontal run at y=675.11 then up to y=314.71. Band on the
  // left normal of →x (= +y on a y-down screen): y max = 675.11 + 11.81, and
  // the vertical run's band at x max = 923.95 + 11.81.
  const ys = pts.map((p) => p.y);
  check(
    "band width = 11.81 px on one side",
    near(Math.max(...ys), 675.112 + W10, 0.1) &&
      near(Math.min(...ys), 314.709, 0.1) &&
      near(Math.max(...xs), 923.954 + W10, 0.1),
    `y ∈ [${Math.min(...ys).toFixed(2)}, ${Math.max(...ys).toFixed(2)}], x max ${Math.max(...xs).toFixed(2)}`
  );
  check(
    "band starts at the director start (no round overshoot)",
    near(Math.min(...xs), 385.961, 0.1)
  );
  const director = ctx.ops.filter(
    (o) => o.op === "stroke" && o.style.lineWidth === 2
  );
  check(
    "director open (not closed)",
    director.length === 1 && !director[0].subPaths[0].closed
  );
}

// --- 3. Window: white gap + frame + centre line ---------------------------
console.log("window (OPENING)");
{
  const ctx = makeCtx();
  drawAnnotation(ctx, windowLeft, meterByPx);
  const gap = ctx.ops.find(
    (o) => o.op === "stroke" && o.style.strokeStyle === "#ffffff"
  );
  check("white gap band", Boolean(gap));
  check(
    "gap width = wall thickness 23.62",
    near(gap.style.lineWidth, W20, 0.01)
  );
  check("gap butt caps", gap.style.lineCap === "butt");
  const p = gap.subPaths[0].pts;
  check(
    "gap on the stored (median) points",
    near(p[0].x, 374.15) &&
      near(p[0].y, 463.571) &&
      near(p[1].x, 374.15) &&
      near(p[1].y, 581.681)
  );
  const rect = ctx.ops.find((o) => o.op === "strokeRect");
  check(
    "frame rect",
    rect &&
      near(rect.w, 118.11, 0.01) &&
      near(rect.h, W20, 0.01) &&
      near(rect.y, -W20 / 2, 0.01)
  );
  const centre = ctx.ops.filter(
    (o) => o.op === "stroke" && o.style.lineWidth === 1
  );
  check(
    "window centre line",
    centre.length === 1 && near(centre[0].subPaths[0].pts[1].x, 118.11, 0.01)
  );
  const rot = ctx.ops.find((o) => o.op === "rotate");
  check(
    "frame rotated along the wall (vertical → 90°)",
    rot && near(rot.a, Math.PI / 2, 1e-6)
  );
}

// --- 4. Door: leaf + swing arc --------------------------------------------
console.log("door (OPENING)");
{
  const ctx = makeCtx();
  drawAnnotation(ctx, door, meterByPx);
  const gap = ctx.ops.find(
    (o) => o.op === "stroke" && o.style.strokeStyle === "#ffffff"
  );
  check("white gap band", Boolean(gap) && near(gap.style.lineWidth, W20, 0.01));
  const leaf = ctx.ops.find(
    (o) => o.op === "stroke" && o.style.lineWidth === 1.5
  );
  check("leaf stroke 1.5px", Boolean(leaf));
  const lp = leaf.subPaths[0].pts;
  const leafLen = Math.hypot(lp[1].x - lp[0].x, lp[1].y - lp[0].y);
  check(
    "leaf length = opening length 106.3",
    near(leafLen, 106.299, 0.01),
    leafLen.toFixed(3)
  );
  // hinge END → p2 (776.9), side −1 → right normal of →x = (0, −1) → upwards
  check(
    "leaf hinged on p2 (END), on the upper wall face",
    near(lp[0].x, 776.926) && near(lp[0].y, 1347.662 - W20 / 2, 0.01)
  );
  check("leaf goes up (doorSide −1)", lp[1].y < lp[0].y);
  const arc = ctx.ops.find((o) => o.op === "arc");
  check(
    "swing arc centred on the leaf start",
    arc &&
      near(arc.cx, lp[0].x) &&
      near(arc.cy, lp[0].y) &&
      near(arc.r, 106.299, 0.01)
  );
  // from leaf tip (angle −90°) to the opposite jamb (angle 180°): going
  // anticlockwise on screen (decreasing angle) = ccw true = sweepFlag 0
  check("arc direction is the 90° sweep", arc && arc.ccw === true);
  check(
    "leaf colour = strokeColor @ 0.6",
    leaf.style.strokeStyle === "rgba(161,136,127,0.6)"
  );
}

// --- 5. Draw order: openings after their host -----------------------------
console.log("draw order");
{
  const order = sortOpeningsLast([door, wall, windowLeft, partition]).map(
    (a) => a.id
  );
  check(
    "openings last",
    order.join(",") === "wall,partition,door,windowLeft",
    order.join(",")
  );
}

// --- 6. Closed / hidden POLYLINE ------------------------------------------
console.log("POLYLINE closeLine / hidden segments");
{
  const base = {
    id: "pl",
    type: "POLYLINE",
    strokeColor: "#ff0000",
    strokeWidth: 3,
    strokeWidthUnit: "PX",
    points: [
      sq("1", 0, 0),
      sq("2", 100, 0),
      sq("3", 100, 100),
      sq("4", 0, 100),
    ],
  };
  let ctx = makeCtx();
  drawAnnotation(ctx, { ...base, closeLine: true }, meterByPx);
  let strokes = ctx.ops.filter((o) => o.op === "stroke");
  check(
    "closeLine → one closed stroke",
    strokes.length === 1 && strokes[0].subPaths[0].closed
  );
  check(
    "butt caps / round joins",
    strokes[0].style.lineCap === "butt" && strokes[0].style.lineJoin === "round"
  );

  ctx = makeCtx();
  drawAnnotation(ctx, { ...base, closeLine: false }, meterByPx);
  strokes = ctx.ops.filter((o) => o.op === "stroke");
  check(
    "open polyline → not closed",
    strokes.length === 1 && !strokes[0].subPaths[0].closed
  );

  ctx = makeCtx();
  drawAnnotation(ctx, { ...base, hiddenSegmentsIdx: [1] }, meterByPx);
  strokes = ctx.ops.filter((o) => o.op === "stroke");
  check(
    "hidden segment → two runs",
    strokes.length === 2 && strokes.every((s) => !s.subPaths[0].closed),
    `${strokes.length} strokes`
  );
  check(
    "runs = [0→1] and [2→3]",
    strokes[0].subPaths[0].pts.length === 2 &&
      near(strokes[0].subPaths[0].pts[1].x, 100) &&
      strokes[1].subPaths[0].pts.length === 2 &&
      near(strokes[1].subPaths[0].pts[0].y, 100)
  );

  // S-C-S arc: a "circle" control point is tessellated, not a straight lineTo
  ctx = makeCtx();
  drawAnnotation(
    ctx,
    {
      ...base,
      points: [
        sq("1", 0, 0),
        { id: "c", x: 50, y: 50, type: "circle" },
        sq("3", 100, 0),
      ],
    },
    meterByPx
  );
  strokes = ctx.ops.filter((o) => o.op === "stroke");
  check(
    "arc tessellated (> 3 points)",
    strokes[0].subPaths[0].pts.length > 3,
    `${strokes[0].subPaths[0].pts.length} pts`
  );
}

// --- 7. Bounds include the offset band ------------------------------------
console.log("bounds");
{
  const b = getAnnotationsBounds([wall], meterByPx);
  check(
    "bounds reach the outer band edge",
    near(b.minX, 385.961 - W20, 0.1) && near(b.minY, 314.709 - W20, 0.1)
  );
  const bd = getAnnotationsBounds([door], meterByPx);
  check(
    "door bounds include the swing",
    bd.minY < 1347.662 - 100,
    `minY = ${bd.minY.toFixed(1)}`
  );
}

console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
