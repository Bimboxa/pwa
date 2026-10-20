/* global process */
// Node replay of the portfolio cartouche scale rule
// (portfolioEditor/utils/getPortfolioPageScaleLabel.js): the "1:N" label
// survives a crop (same pt-per-px ratio) and disappears on zoom / stretch.
//
// Run from the repo root:
//   node_modules/.bin/esbuild specs/portfolioEditor/container-crop-scale-lock/scaleLabelReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/scaleLabelReplay.mjs && node /tmp/scaleLabelReplay.mjs
//
// Exits 1 on any failure.

import getPortfolioPageScaleLabel, {
  getLargestBaseMapContainer,
} from "Features/portfolioEditor/utils/getPortfolioPageScaleLabel";
import getPageDimensions from "Features/portfolioEditor/utils/getPageDimensions";
import resolveContainerScaleLocked from "Features/portfolioEditor/utils/resolveContainerScaleLocked";
import getBaseMapContainerDefaultLayout from "Features/portfolioEditor/utils/getBaseMapContainerDefaultLayout";

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// A3 landscape sheet (1191 x 842 pt) printed at 1:100 from a zone of
// 4000 x 2828 reference px.
const printZone = {
  format: "A3",
  orientation: "landscape",
  scale: 100,
  x: 120,
  y: 80,
  width: 4000,
  height: 2828,
};
const page = { format: "A3", orientation: "landscape" };
const dims = getPageDimensions("A3", "landscape");
const zoneViewBox = { x: 120, y: 80, width: 4000, height: 2828 };
const kZone = dims.width / printZone.width;

const label = (container) =>
  getPortfolioPageScaleLabel({ page, container, printZone });

console.log("default layout");
const layout = getBaseMapContainerDefaultLayout({
  printZone,
  imageSize: { width: 5000, height: 3000 },
  contentArea: { x: 16, y: 16, width: 1000, height: 700 },
});
check(
  "zone → full page + zone viewBox + page format",
  layout.x === 0 &&
    layout.y === 0 &&
    layout.width === dims.width &&
    layout.height === dims.height &&
    layout.viewBox.width === 4000 &&
    layout.pageFormat.format === "A3" &&
    layout.pageFormat.orientation === "landscape"
);
const fitted = getBaseMapContainerDefaultLayout({
  printZone: null,
  imageSize: { width: 2000, height: 1000 },
  contentArea: { x: 16, y: 16, width: 1000, height: 700 },
});
check(
  "no zone → fitted to content area, full-image viewBox, page kept",
  fitted.width === 1000 &&
    fitted.height === 500 &&
    fitted.viewBox.width === 2000 &&
    fitted.pageFormat === null
);
check(
  "nothing known → null",
  getBaseMapContainerDefaultLayout({ printZone: null, imageSize: null }) ===
    null
);

console.log("cartouche scale label");
const fullPage = { baseMapId: "bm", ...layout };
check("full page = 1:100", label(fullPage) === "1:100", label(fullPage));
check(
  "missing viewBox = default framing = 1:100",
  label({ ...fullPage, viewBox: null }) === "1:100"
);

// « Croper »: frame shrunk on the page, viewBox shrunk by the same ratio.
const cropped = {
  baseMapId: "bm",
  x: 100,
  y: 60,
  width: dims.width * 0.5,
  height: dims.height * 0.4,
  viewBox: {
    x: zoneViewBox.x + 500,
    y: zoneViewBox.y + 300,
    width: zoneViewBox.width * 0.5,
    height: zoneViewBox.height * 0.4,
  },
};
check("cropped same ratio = 1:100", label(cropped) === "1:100", label(cropped));

// « Cadrer » wheel: same frame, zoomed viewBox.
const zoomed = {
  ...fullPage,
  viewBox: { ...zoneViewBox, width: 3000, height: 2121 },
};
check("zoomed = no label", label(zoomed) === "", label(zoomed));

// Stretch (unlocked handles): frame grows, viewBox unchanged.
const stretched = {
  ...fullPage,
  width: dims.width * 1.2,
  height: dims.height * 1.2,
};
check("stretched = no label", label(stretched) === "", label(stretched));

// Non-uniform: width ratio ok, height ratio off.
const skewed = { ...cropped, height: cropped.height * 1.1 };
check("non-uniform ratio = no label", label(skewed) === "", label(skewed));

// Tolerance: 0.4 % drift keeps the label, 1 % loses it.
const drift = (f) => ({
  ...fullPage,
  width: dims.width * f,
  height: dims.height * f,
});
check("0.4 % drift keeps 1:100", label(drift(1.004)) === "1:100");
check("1 % drift loses the label", label(drift(1.01)) === "");

// Page format differs from the zone but ratio kept (A3 zone on an A2 page).
const onA2 = { ...cropped };
check(
  "same ratio on another page format keeps 1:100",
  getPortfolioPageScaleLabel({
    page: { format: "A2", orientation: "landscape" },
    container: onA2,
    printZone,
  }) === "1:100"
);

check(
  "« libre » zone (no scale) = no label",
  label({ ...fullPage }) === "1:100" &&
    getPortfolioPageScaleLabel({
      page,
      container: fullPage,
      printZone: { ...printZone, scale: null },
    }) === ""
);
check("kZone sanity", Math.abs(kZone - dims.width / 4000) < 1e-12);

console.log("largest container");
check(
  "largest by area, ignores deleted / empty",
  getLargestBaseMapContainer([
    { id: "a", baseMapId: "bm", width: 10, height: 10 },
    { id: "b", baseMapId: "bm", width: 100, height: 100, deletedAt: 1 },
    { id: "c", baseMapId: null, width: 1000, height: 1000 },
    { id: "d", baseMapId: "bm", width: 50, height: 50 },
  ])?.id === "d"
);

console.log("scale lock default");
check(
  "unset + scaled zone → locked",
  resolveContainerScaleLocked({}, printZone) === true
);
check(
  "unset + libre zone → unlocked",
  resolveContainerScaleLocked({}, { ...printZone, scale: null }) === false
);
check(
  "unset + no zone → unlocked",
  resolveContainerScaleLocked({}, null) === false
);
check(
  "stored false wins over scaled zone",
  resolveContainerScaleLocked({ scaleLocked: false }, printZone) === false
);
check(
  "stored true wins over libre zone",
  resolveContainerScaleLocked({ scaleLocked: true }, null) === true
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall good");
