// Node replay of glued openings hosted on a STRIP: the opening glues on the
// band's MEDIAN line (stored edge offset by half the signed width), while the
// anchor still references the stored vertices.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/openingStripHostReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/openingStripHostReplay.mjs && node /tmp/openingStripHostReplay.mjs
//
// Scenarios: buildHostCurve lateral offset (straight + CW / CCW arcs),
// STRIP placement on both sides, hover from anywhere inside the band, closed
// strip + hidden segment, POLYLINE non-regression (offset 0), and reflow
// idempotence (projected centre → same endpoints). Exits 1 on any failure.

import computeOpeningEndpointsFromHost, {
  buildHostCurve,
} from "Features/mapEditor/utils/computeOpeningEndpointsFromHost";
import computeOpeningSegmentPlacement from "Features/mapEditor/utils/computeOpeningSegmentPlacement";
import getOpeningHostOffsetPx from "Features/mapEditor/utils/getOpeningHostOffsetPx";

let failures = 0;

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const nearPt = (p, x, y, eps = 1e-6) => near(p.x, x, eps) && near(p.y, y, eps);
const fmt = (p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;

// 1 px = 1 cm on this base map.
const METER_BY_PX = 0.01;

// --- buildHostCurve offset ---

console.log("buildHostCurve — lateral offset");

{
  const A = { x: 0, y: 0 };
  const B = { x: 1000, y: 0 };
  const c = buildHostCurve(A, B, null, 10);
  check(
    "straight: start shifted along the left normal (0,1)",
    nearPt(c.pointAt(0), 0, 10)
  );
  check("straight: end shifted too", nearPt(c.pointAt(c.len), 1000, 10));
  check("straight: length preserved", near(c.len, 1000));
  const proj = c.project({ x: 500, y: 10 });
  check(
    "straight: median point projects at distance 0",
    near(proj.distance, 0) && near(proj.s, 500)
  );
  const c0 = buildHostCurve(A, B, null, 0);
  check(
    "straight: offset 0 = legacy curve",
    nearPt(c0.pointAt(0), 0, 0) && nearPt(c0.pointAt(1000), 1000, 0)
  );
  const cNeg = buildHostCurve(A, B, null, -10);
  check(
    "straight: negative offset goes right",
    nearPt(cNeg.pointAt(0), 0, -10)
  );
}

{
  // CCW arc (y-down frame): A → C(100,100) → B, centre (100,0), r 100.
  const A = { x: 0, y: 0 };
  const C = { x: 100, y: 100 };
  const B = { x: 200, y: 0 };
  const base = buildHostCurve(A, B, C, 0);
  const off = buildHostCurve(A, B, C, 10);
  check("ccw arc: base length = π·100", near(base.len, Math.PI * 100, 1e-6));
  check(
    "ccw arc: left normal points outward → r' = 110",
    near(off.len, Math.PI * 110, 1e-6)
  );
  check(
    "ccw arc: start on the offset circle",
    nearPt(off.pointAt(0), -10, 0, 1e-6)
  );
  check(
    "ccw arc: end on the offset circle",
    nearPt(off.pointAt(off.len), 210, 0, 1e-6)
  );
  const proj = off.project({ x: 100, y: 110 });
  check(
    "ccw arc: median apex projects at distance 0, mid-abscissa",
    near(proj.distance, 0, 1e-6) && near(proj.s, off.len / 2, 1e-6)
  );
}

{
  // CW arc: A → C(100,-100) → B, same centre, r 100.
  const A = { x: 0, y: 0 };
  const C = { x: 100, y: -100 };
  const B = { x: 200, y: 0 };
  const off = buildHostCurve(A, B, C, 10);
  check(
    "cw arc: left normal points to the centre → r' = 90",
    near(off.len, Math.PI * 90, 1e-6)
  );
  check(
    "cw arc: start on the offset circle",
    nearPt(off.pointAt(0), 10, 0, 1e-6)
  );
}

// --- getOpeningHostOffsetPx ---

console.log("getOpeningHostOffsetPx");

const stripBase = {
  id: "strip1",
  type: "STRIP",
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  stripOrientation: 1,
};
check(
  "STRIP +1 → +d/2 (20cm → 20px → 10)",
  near(getOpeningHostOffsetPx(stripBase, METER_BY_PX), 10)
);
check(
  "STRIP -1 → -d/2",
  near(
    getOpeningHostOffsetPx({ ...stripBase, stripOrientation: -1 }, METER_BY_PX),
    -10
  )
);
check(
  "POLYLINE → 0",
  getOpeningHostOffsetPx({ type: "POLYLINE", strokeWidth: 20 }, METER_BY_PX) ===
    0
);
check(
  "POLYGON → 0",
  getOpeningHostOffsetPx({ type: "POLYGON" }, METER_BY_PX) === 0
);

// --- placement on a STRIP ---

console.log("computeOpeningSegmentPlacement — STRIP host");

const sq = (id, x, y) => ({ id, x, y, type: "square" });
const stripH = {
  ...stripBase,
  points: [sq("a", 0, 0), sq("b", 1000, 0)],
};
const L = 90; // 0.9 m opening
const place = (annotations, cursor, extra = {}) =>
  computeOpeningSegmentPlacement({
    cursorPx: cursor,
    annotations,
    openingLengthPx: L,
    hoverThresholdPx: 10,
    vertexSnapPx: 0,
    anchorEnd: "start",
    meterByPx: METER_BY_PX,
    ...extra,
  });

{
  const r = place([stripH], { x: 500, y: 5 });
  check("side +1: placement found", Boolean(r) && r.fits);
  check(
    "side +1: p1/p2 on the median y = 10",
    r && near(r.p1.y, 10) && near(r.p2.y, 10),
    r && `${fmt(r.p1)} ${fmt(r.p2)}`
  );
  check(
    "side +1: p1 at the cursor abscissa, p2 = p1 + L",
    r && near(r.p1.x, 500) && near(r.p2.x, 590)
  );
  check("side +1: hostOffsetPx = 10", r && near(r.hostOffsetPx, 10));
  check(
    "side +1: anchor ids = stored vertices",
    r && r.segStartId === "a" && r.segEndId === "b"
  );
  check(
    "side +1: segStart/segEnd = stored (un-offset) vertices",
    r && nearPt(r.segStart, 0, 0) && nearPt(r.segEnd, 1000, 0)
  );
  check(
    "side +1: hostDistancePx = opening centre abscissa",
    r && near(r.hostDistancePx, 545)
  );
}

{
  const r = place([{ ...stripH, stripOrientation: -1 }], { x: 500, y: -5 });
  check(
    "side -1: p1/p2 on the median y = -10",
    r && near(r.p1.y, -10) && near(r.p2.y, -10),
    r && `${fmt(r.p1)} ${fmt(r.p2)}`
  );
  check("side -1: hostOffsetPx = -10", r && near(r.hostOffsetPx, -10));
}

{
  // Cursor on the far edge of the band (y = 20, 10 px from the median):
  // the hover threshold grows by |offset| so the whole band hovers.
  const far = place([stripH], { x: 500, y: 20 });
  check("hover from the far band edge", Boolean(far) && near(far.p1.y, 10));
  const outside = place([stripH], { x: 500, y: 35 });
  check("35 px away (> 10 + 10) → no host", outside === null);
  const legacyOnly = place(
    [stripH],
    { x: 500, y: 5 },
    { meterByPx: undefined }
  );
  // Without a scale, CM widths fall back to raw px (20 → offset 10): still hosts.
  check(
    "no meterByPx: CM width falls back to raw px, still hosts",
    Boolean(legacyOnly)
  );
}

{
  // Closed strip (implicit: last == first) with segment 0 hidden.
  const closedStrip = {
    ...stripBase,
    id: "strip2",
    hiddenSegmentsIdx: [0],
    points: [
      sq("a", 0, 0),
      sq("b", 1000, 0),
      sq("c", 1000, 1000),
      sq("d", 0, 1000),
      sq("a", 0, 0),
    ],
  };
  const onHidden = place([closedStrip], { x: 500, y: 5 });
  check("closed strip: hidden segment 0 does not host", onHidden === null);
  // Segment 1 (b → c) travels +y, left normal (-1, 0): median at x = 990.
  const onSeg1 = place([closedStrip], { x: 995, y: 500 });
  check(
    "closed strip: segment 1 hosts on its median x = 990",
    onSeg1 && near(onSeg1.p1.x, 990) && onSeg1.hostSegmentIndex === 1,
    onSeg1 && fmt(onSeg1.p1)
  );
  // Closing segment 3 (d → a) travels -y, left normal (1, 0): median at x = 10.
  const onClosing = place([closedStrip], { x: 5, y: 500 });
  check(
    "closed strip: closing segment hosts (implicit closure)",
    onClosing &&
      near(onClosing.p1.x, 10) &&
      onClosing.segStartId === "d" &&
      onClosing.segEndId === "a",
    onClosing && fmt(onClosing.p1)
  );
}

{
  // POLYLINE host: unchanged behaviour (offset 0).
  const poly = {
    id: "poly1",
    type: "POLYLINE",
    strokeWidth: 20,
    strokeWidthUnit: "CM",
    points: [sq("a", 0, 0), sq("b", 1000, 0)],
  };
  const r = place([poly], { x: 500, y: 5 });
  check(
    "POLYLINE: hostOffsetPx = 0, p1 on the stored line",
    r && r.hostOffsetPx === 0 && near(r.p1.y, 0)
  );
}

// --- reflow idempotence ---

console.log("reflow idempotence — projected centre reproduces the endpoints");

{
  const r = place([stripH], { x: 500, y: 5 });
  const center = { x: (r.p1.x + r.p2.x) / 2, y: (r.p1.y + r.p2.y) / 2 };
  const curve = buildHostCurve(
    r.segStart,
    r.segEnd,
    r.arcControl,
    r.hostOffsetPx
  );
  const res = computeOpeningEndpointsFromHost({
    segStartPx: r.segStart,
    segEndPx: r.segEnd,
    hostDistancePx: curve.project(center).s,
    openingLengthPx: L,
    arcControlPx: r.arcControl,
    hostOffsetPx: getOpeningHostOffsetPx(stripH, METER_BY_PX),
  });
  check(
    "endpoints reproduced",
    res.fits &&
      nearPt(res.p1, r.p1.x, r.p1.y) &&
      nearPt(res.p2, r.p2.x, r.p2.y),
    `${fmt(res.p1)} ${fmt(res.p2)}`
  );
  // Thickness change: same anchor distance, opening moves to the new median.
  const thick = computeOpeningEndpointsFromHost({
    segStartPx: r.segStart,
    segEndPx: r.segEnd,
    hostDistancePx: r.hostDistancePx,
    openingLengthPx: L,
    arcControlPx: null,
    hostOffsetPx: getOpeningHostOffsetPx(
      { ...stripH, strokeWidth: 40 },
      METER_BY_PX
    ),
  });
  check(
    "thickness 20 → 40 cm: opening follows the median (y = 20)",
    near(thick.p1.y, 20) && near(thick.p1.x, r.p1.x)
  );
  // Side flip: same anchor, opening jumps to the other side.
  const flipped = computeOpeningEndpointsFromHost({
    segStartPx: r.segStart,
    segEndPx: r.segEnd,
    hostDistancePx: r.hostDistancePx,
    openingLengthPx: L,
    arcControlPx: null,
    hostOffsetPx: getOpeningHostOffsetPx(
      { ...stripH, stripOrientation: -1 },
      METER_BY_PX
    ),
  });
  check("side flip: opening moves to y = -10", near(flipped.p1.y, -10));
  // Too-short segment: spans the OFFSET segment.
  const short = computeOpeningEndpointsFromHost({
    segStartPx: { x: 0, y: 0 },
    segEndPx: { x: 50, y: 0 },
    hostDistancePx: 25,
    openingLengthPx: L,
    arcControlPx: null,
    hostOffsetPx: 10,
  });
  check(
    "segment shorter than the opening: spans the offset segment",
    !short.fits && nearPt(short.p1, 0, 10) && nearPt(short.p2, 50, 10)
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
