// Generates expected-render.svg next to this spec, from the REAL
// implementation output (applyLayerStackingToAnnotations + getStripePolygons
// + the membrane dash geometry used by NodeStripStatic). The SVG shows the
// reference example twice: (A) the stored support points, (B) the expected
// stacked render. Regenerate it whenever the stacking algorithm changes.
//
// Run from the repo root:
//   node_modules/.bin/esbuild specs/annotations/material-layers-strip/generateExpectedRender.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/specRender.mjs && node /tmp/specRender.mjs

import fs from "node:fs";
import path from "node:path";

import applyLayerStackingToAnnotations from "Features/annotations/utils/applyLayerStackingToAnnotations";
import getStripePolygons, {
  getStripChunks,
  getStripDistancePx,
  ARC_SAMPLES,
  STRIP_DASH_DEFAULTS,
} from "Features/geometry/utils/getStripePolygons";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

const OUT_FILE = path.join(
  process.cwd(),
  "specs/annotations/material-layers-strip/expected-render.svg"
);
const EXAMPLE_FILE = path.join(
  process.cwd(),
  "specs/annotations/material-layers-strip/example-annotations.json"
);

const { meterByPx, annotations } = JSON.parse(
  fs.readFileSync(EXAMPLE_FILE, "utf8")
);

// ---- geometry ----

const stackedById = applyLayerStackingToAnnotations(annotations, {
  baseMapId: annotations[0].baseMapId,
  meterByPx,
});

const pathD = (pts, close) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
  (close ? " Z" : "");

// Same conversion as the renderer (NodeStripStatic).
const toPx = (a, v) =>
  a.strokeWidthUnit === "CM" && meterByPx > 0 ? (v * 0.01) / meterByPx : v;

function layerRender(a) {
  const displayPoints = stackedById.get(a.id) ?? a.points;
  const display = { ...a, points: displayPoints };
  const bands = getStripePolygons(display, meterByPx).map((s) => s.points);
  let dashes = null;
  if (a.strokeType === "DASHED") {
    const distancePx = getStripDistancePx(display, meterByPx);
    const { chunks } = getStripChunks(display);
    dashes = {
      bandWidthPx: Math.abs(distancePx),
      dashPx: toPx(a, Number(a.dashLength) || STRIP_DASH_DEFAULTS.dashLength),
      gapPx: toPx(a, Number(a.dashGap) || STRIP_DASH_DEFAULTS.dashGap),
      centerlines: chunks
        .map((c) => offsetPolyline(expandArcsInPath(c, ARC_SAMPLES, false), distancePx / 2))
        .filter((pts) => pts?.length >= 2),
    };
  }
  return { a, bands, dashes };
}

const renders = annotations.map(layerRender);

// ---- svg ----

// Data bbox ≈ x ∈ [-1530, -140], y ∈ [40, 1345] → shift into positive space.
const DX = 1535;
const DY = -35;
const SCALE = 0.47;

const svg = [];
svg.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 720" font-family="Helvetica, Arial, sans-serif">`
);
svg.push(`<rect x="0" y="0" width="1560" height="720" fill="#ffffff"/>`);
svg.push(
  `<text x="20" y="30" font-size="17" font-weight="bold" fill="#111">A — Points stockés (dessin sur le support commun)</text>`
);
svg.push(
  `<text x="790" y="30" font-size="17" font-weight="bold" fill="#111">B — Rendu attendu (empilement dérivé à l'affichage)</text>`
);

// Panel A: the four support polylines are COLINEAR — nested stroke widths
// keep every color visible.
svg.push(`<g transform="translate(20,50) scale(${SCALE}) translate(${DX},${DY})">`);
const A_WIDTHS = [26, 19, 12, 5];
renders.forEach(({ a }, i) => {
  svg.push(
    `<path d="${pathD(a.points)}" fill="none" stroke="${a.strokeColor}" stroke-width="${A_WIDTHS[i]}" stroke-opacity="0.9" stroke-linejoin="round"/>`
  );
});
// vertex squares of the top layer, to show the edit handles live on the support
renders[renders.length - 1].a.points.forEach((p) => {
  svg.push(
    `<rect x="${p.x - 11}" y="${p.y - 11}" width="22" height="22" fill="#fff" stroke="#2196f3" stroke-width="3"/>`
  );
});
svg.push(`</g>`);

// Panel B: bands painted in layer order (bottom first), membrane rendering
// for DASHED strips — mirrors NodeStripStatic.
svg.push(`<g transform="translate(790,50) scale(${SCALE}) translate(${DX},${DY})">`);
renders.forEach(({ a, bands, dashes }, i) => {
  if (!dashes) {
    bands.forEach((ring) => {
      svg.push(
        `<path d="${pathD(ring, true)}" fill="${a.strokeColor}" fill-opacity="${a.strokeOpacity}" fill-rule="evenodd"/>`
      );
    });
    return;
  }
  const clipId = `band-clip-${i}`;
  svg.push(`<defs><clipPath id="${clipId}">`);
  bands.forEach((ring) => svg.push(`<path d="${pathD(ring, true)}" clip-rule="evenodd"/>`));
  svg.push(`</clipPath></defs>`);
  bands.forEach((ring) => {
    svg.push(
      `<path d="${pathD(ring, true)}" fill="#ffffff" fill-opacity="${a.strokeOpacity}" fill-rule="evenodd" stroke="${a.strokeColor}" stroke-width="2.5" stroke-opacity="${a.strokeOpacity}"/>`
    );
  });
  svg.push(`<g clip-path="url(#${clipId})">`);
  dashes.centerlines.forEach((pts) => {
    svg.push(
      `<path d="${pathD(pts)}" fill="none" stroke="${a.strokeColor}" stroke-opacity="${a.strokeOpacity}" stroke-width="${dashes.bandWidthPx * 0.6}" stroke-dasharray="${dashes.dashPx.toFixed(1)} ${dashes.gapPx.toFixed(1)}" stroke-linecap="butt"/>`
    );
  });
  svg.push(`</g>`);
});
svg.push(`</g>`);

// Legend — stack rank (layerIndex order), bottom of the stack first
renders.forEach(({ a }, i) => {
  const y = 665;
  const x = 790 + i * 190;
  svg.push(`<rect x="${x}" y="${y}" width="16" height="16" fill="${a.strokeColor}" fill-opacity="${a.strokeOpacity}"/>`);
  svg.push(
    `<text x="${x + 22}" y="${y + 13}" font-size="13" fill="#333">Rang ${i + 1} — ${a.strokeType}</text>`
  );
});
svg.push(`</svg>`);

fs.writeFileSync(OUT_FILE, svg.join("\n"), "utf8");
console.log("written", OUT_FILE);
