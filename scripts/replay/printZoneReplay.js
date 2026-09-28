/* global process */
// Node replay of the print zone maths (baseMaps/utils/printZone.js) and of
// the text page-scale switch (getTextPageScale): page sizes, fit / centre,
// scale ↔ meterByPx round trip, format changes.
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/printZoneReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/printZoneReplay.mjs && node /tmp/printZoneReplay.mjs
//
// Exits 1 on any failure.

import getPageDimensions from "Features/portfolioEditor/utils/getPageDimensions";
import {
  applyPrintZoneFormatChange,
  centerPrintZoneOnImage,
  createDefaultPrintZone,
  fitPrintZoneToImage,
  getMeterByPxFromPrintZone,
  getPrintZonePageDimensionsMm,
  getPrintZonePxPerPt,
  getPrintZoneSizePxFromScale,
  getScaleFromPrintZone,
  isPrintZoneValid,
  roundPrintZone,
} from "Features/baseMaps/utils/printZone";
import { getTextPageScale } from "Features/annotations/constants/freeTextConstants";

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const near = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

console.log("page dimensions");
const a0p = getPageDimensions("A0", "portrait");
check("A0 portrait = 2384 x 3370", a0p.width === 2384 && a0p.height === 3370);
const a4mm = getPrintZonePageDimensionsMm("A4", "landscape");
check("A4 landscape width ≈ 297.03 mm", near(a4mm.width, 297.03), a4mm.width);
check("A4 landscape height ≈ 209.9 mm", near(a4mm.height, 209.9), a4mm.height);

console.log("fit to image");
const fit1 = fitPrintZoneToImage({
  format: "A3",
  orientation: "landscape",
  imageSize: { width: 4000, height: 3000 },
});
check("4000x3000 in A3 landscape: height 3000", near(fit1.height, 3000));
check(
  "4000x3000 in A3 landscape: width ≈ 4243.5",
  near(fit1.width, 4243.5, 0.5),
  fit1.width
);
check(
  "4000x3000 in A3 landscape: x ≈ -121.7",
  near(fit1.x, -121.7, 0.5),
  fit1.x
);
check("4000x3000 in A3 landscape: y = 0", near(fit1.y, 0));
const fit2 = fitPrintZoneToImage({
  format: "A3",
  orientation: "landscape",
  imageSize: { width: 5000, height: 3000 },
});
check("5000x3000 in A3 landscape: width 5000", near(fit2.width, 5000));
check(
  "5000x3000 in A3 landscape: height ≈ 3534.9",
  near(fit2.height, 3534.9, 0.5),
  fit2.height
);
check("5000x3000: y centred ≈ -267.4", near(fit2.y, -267.4, 0.5), fit2.y);

console.log("default zone + validity");
const def = createDefaultPrintZone({
  imageSize: { width: 4000, height: 3000 },
});
check("default is valid", isPrintZoneValid(def));
check(
  "default is A3 landscape, free scale",
  def.format === "A3" && def.orientation === "landscape" && def.scale === null
);
check("invalid format rejected", !isPrintZoneValid({ ...def, format: "B1" }));
check("zero width rejected", !isPrintZoneValid({ ...def, width: 0 }));
check("null rejected", !isPrintZoneValid(null));
const rounded = roundPrintZone({
  ...def,
  x: 1.4,
  y: -2.6,
  width: 10.5,
  height: 7.49,
});
check(
  "round to integers",
  rounded.x === 1 &&
    rounded.y === -3 &&
    rounded.width === 11 &&
    rounded.height === 7
);

console.log("scale round trip");
// A3 landscape width = 1191 pt = 420.16 mm → 420.16 * 100 / (1000 * 0.002)
const meterByPx = 0.002;
const A3_W_PX_1_100 = (((1191 * 25.4) / 72) * 100) / (1000 * meterByPx);
const size = getPrintZoneSizePxFromScale({
  format: "A3",
  orientation: "landscape",
  scale: 100,
  meterByPx,
});
check(
  "A3 landscape 1:100 at 0.002 m/px: width ≈ 21008 px",
  near(size.width, A3_W_PX_1_100, 1e-6),
  size.width
);
const zone = {
  format: "A3",
  orientation: "landscape",
  scale: 100,
  x: 0,
  y: 0,
  ...size,
};
check(
  "meterByPx from zone = 0.002",
  near(getMeterByPxFromPrintZone(zone), 0.002, 1e-9),
  getMeterByPxFromPrintZone(zone)
);
check(
  "scale from zone = 100",
  near(getScaleFromPrintZone(zone, meterByPx), 100, 1e-6)
);
check(
  "no scale → meterByPx null",
  getMeterByPxFromPrintZone({ ...zone, scale: null }) === null
);
check("no meterByPx → scale null", getScaleFromPrintZone(zone, null) === null);

console.log("px per pt");
const a4z = {
  format: "A4",
  orientation: "landscape",
  scale: null,
  x: 0,
  y: 0,
  width: 2480,
  height: 2480 / (842 / 595),
};
check(
  "A4 landscape width 2480 px → ≈ 2.9454 px/pt",
  near(getPrintZonePxPerPt(a4z), 2.9454, 1e-3),
  getPrintZonePxPerPt(a4z)
);
check("invalid zone → null", getPrintZonePxPerPt(null) === null);

console.log("format change");
const free = {
  format: "A3",
  orientation: "landscape",
  scale: null,
  x: 100,
  y: 200,
  width: 4200,
  height: 4200 / (1191 / 842),
};
const freeA4 = applyPrintZoneFormatChange(free, { format: "A4" });
check(
  "free A3→A4 keeps px/mm (width × 842/1191)",
  near(freeA4.width, (4200 * 842) / 1191, 1e-6),
  freeA4.width
);
check(
  "free A3→A4 keeps centre x",
  near(freeA4.x + freeA4.width / 2, free.x + free.width / 2, 1e-6)
);
check(
  "free A3→A4 keeps centre y",
  near(freeA4.y + freeA4.height / 2, free.y + free.height / 2, 1e-6)
);
const portrait = applyPrintZoneFormatChange(free, { orientation: "portrait" });
check(
  "orientation swap swaps width/height",
  near(portrait.width, free.height, 1e-6) &&
    near(portrait.height, free.width, 1e-6)
);
const locked = applyPrintZoneFormatChange(free, { scale: 100, meterByPx });
check(
  "locked snaps to the 1:100 size",
  near(locked.width, A3_W_PX_1_100, 1e-6),
  locked.width
);
check("locked keeps scale", locked.scale === 100);
const unlocked = applyPrintZoneFormatChange(locked, { scale: null, meterByPx });
check(
  "unlock keeps the size",
  near(unlocked.width, locked.width, 1e-6) && unlocked.scale === null
);
const noMbpx = applyPrintZoneFormatChange(free, { scale: 50, meterByPx: null });
check(
  "scale without meterByPx: stored, size kept",
  noMbpx.scale === 50 && near(noMbpx.width, free.width, 1e-6)
);

console.log("centre");
const centred = centerPrintZoneOnImage(free, { width: 4000, height: 3000 });
check("centred x", near(centred.x, (4000 - free.width) / 2, 1e-6));
check("centred y", near(centred.y, (3000 - free.height) / 2, 1e-6));

console.log("text page scale");
check(
  "zone wins",
  getTextPageScale({
    pagePxPerPt: 3,
    pageFormat: "A3",
    imageLongSidePx: 2382,
  }) === 3
);
check(
  "legacy A3 2382 px → 2",
  getTextPageScale({
    pagePxPerPt: null,
    pageFormat: "A3",
    imageLongSidePx: 2382,
  }) === 2
);
check(
  "legacy A4 default",
  getTextPageScale({ pageFormat: undefined, imageLongSidePx: 842 }) === 1
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall ok");
