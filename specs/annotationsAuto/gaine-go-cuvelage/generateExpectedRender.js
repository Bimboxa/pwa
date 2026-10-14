/* global process */
// Generates expected-render.svg next to this spec, from the REAL
// implementation output: gaineGoV1 replayed on the seuil of the reference
// example (plan view of the generated GO gaine: Sol, U wall band, slab
// underside, trémie and its walls), then gaineCuvelageV1 replayed on a
// duplicate of that Sol for three water levels. Regenerate it whenever the
// builders change.
//
// Run from the repo root:
//   node_modules/.bin/esbuild specs/annotationsAuto/gaine-go-cuvelage/generateExpectedRender.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/specRenderGaine.mjs && node /tmp/specRenderGaine.mjs

import fs from "node:fs";
import path from "node:path";

import getStripePolygons from "Features/geometry/utils/getStripePolygons";

import gaineGoV1 from "../../../src/Data/edx/automatedAnnotationsProcedures/gaine/gaineGoV1.js";
import gaineCuvelageV1 from "../../../src/Data/edx/automatedAnnotationsProcedures/gaine/gaineCuvelageV1.js";

const DIR = path.join(process.cwd(), "specs/annotationsAuto/gaine-go-cuvelage");
const example = JSON.parse(
  fs.readFileSync(path.join(DIR, "example-annotations.json"), "utf8")
);
const { imageSize, meterByPx, params } = example;

// ---- fixture (same as the node tests) ----

const GO = "lstGo";
const CVG = "lstCvg";
const goTemplates = [
  {
    id: "tplSeuil",
    label: "Seuil gaine",
    listingId: GO,
    drawingShape: "POLYLINE",
    strokeWidth: 20,
    strokeWidthUnit: "CM",
  },
  {
    id: "tplSol",
    label: "Sol",
    listingId: GO,
    drawingShape: "POLYGON",
    mappingCategories: ["OUVRAGE:SOL"],
  },
  {
    id: "tplVoile",
    label: "Voile béton",
    listingId: GO,
    drawingShape: "POLYLINE",
    strokeWidth: 20,
    strokeWidthUnit: "CM",
    height: 2.5,
    isExt: true,
    mappingCategories: ["TOPO:FRONTIERE_SOL"],
  },
  {
    id: "tplSousFace",
    label: "Sous-face dalle",
    listingId: GO,
    drawingShape: "POLYGON",
    mappingCategories: ["TOPO:SOUS_FACE_PLANCHER"],
  },
  {
    id: "tplTremie",
    label: "Trémie ventilation",
    listingId: GO,
    drawingShape: "POLYGON",
    mappingCategories: ["TOPO:TREMIE"],
  },
];
const cvgTemplates = [
  {
    id: "tplCvgSol",
    label: "Sol",
    listingId: CVG,
    drawingShape: "POLYGON",
    mappingCategories: ["CVG:SOL"],
  },
  {
    id: "tplCvgParoi",
    label: "Paroi",
    listingId: CVG,
    drawingShape: "POLYLINE",
    strokeWidth: 2,
    strokeWidthUnit: "PX",
    mappingCategories: ["CVG:PAROI"],
  },
  {
    id: "tplCvgSousFace",
    label: "Sous-face dalle",
    listingId: CVG,
    drawingShape: "POLYGON",
    mappingCategories: ["CVG:SOUS_FACE"],
  },
];
const seuilExample = example.handDrawnGo.find((a) => a.role === "seuil");
const seuil = {
  id: "seuil1",
  type: "STRIP",
  listingId: GO,
  annotationTemplateId: "tplSeuil",
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  stripOrientation: seuilExample.stripOrientation,
  points: seuilExample.points,
};
const go = gaineGoV1({
  sourceAnnotations: [seuil],
  templatesByListingId: new Map([[GO, goTemplates]]),
  imageSize,
  meterByPx,
  context: { projectId: "p", baseMapId: "b", procedureParams: params },
});
if (go.error) throw new Error(go.error);

const pxById = new Map(seuil.points.map((p) => [p.id, p]));
for (const p of go.points) {
  pxById.set(p.id, { x: p.x * imageSize.width, y: p.y * imageSize.height });
}
const resolve = (a, index = pxById) => ({
  ...a,
  points: a.points.map((r) => ({
    ...r,
    x: index.get(r.id).x,
    y: index.get(r.id).y,
  })),
});
const goRows = go.annotations.map((a) => resolve(a));
const goSol = goRows.find((a) => a.annotationTemplateId === "tplSol");
const cvgSol = {
  ...goSol,
  id: "cvgSol",
  listingId: CVG,
  annotationTemplateId: "tplCvgSol",
  points: goSol.points.map((p, i) => ({ ...p, id: `c${i}` })),
};
const adjacency = goRows
  .filter((a) => a.annotationTemplateId !== "tplSol")
  .map((a) => ({ ...a, isAdjacencyOnly: true }));

function runCuvelage(waterRel) {
  const r = gaineCuvelageV1({
    sourceAnnotations: [cvgSol, ...adjacency],
    templatesByListingId: new Map([
      [GO, goTemplates],
      [CVG, cvgTemplates],
    ]),
    imageSize,
    meterByPx,
    context: { projectId: "p", baseMapId: "b", waterRel },
  });
  const index = new Map(
    r.points.map((p) => [
      p.id,
      { x: p.x * imageSize.width, y: p.y * imageSize.height },
    ])
  );
  return (r.annotations ?? []).map((a) => resolve(a, index));
}

// ---- SVG ----

const allPts = goRows.flatMap((a) => a.points);
const minX = Math.min(...allPts.map((p) => p.x)) - 40;
const maxX = Math.max(...allPts.map((p) => p.x)) + 40;
const minY = Math.min(...allPts.map((p) => p.y)) - 40;
const maxY = Math.max(...allPts.map((p) => p.y)) + 40;
const W = maxX - minX;
const H = maxY - minY;
const PANEL_GAP = 30;
const panels = [
  { title: "A — GO gaine généré (vue en plan)", rows: goRows, kind: "go" },
  { title: "B — Cuvelage, eau 0.5 m", rows: runCuvelage(0.5), kind: "cvg" },
  { title: "C — Cuvelage, eau 1.1 m", rows: runCuvelage(1.1), kind: "cvg" },
  {
    title: "D — Cuvelage, sans hauteur d'eau",
    rows: runCuvelage(null),
    kind: "cvg",
  },
];
const SCALE = 1.2;
const PW = W * SCALE;
const PH = H * SCALE + 24;
const svgW = PW + 40;
const svgH = panels.length * (PH + PANEL_GAP) + 20;

const toSvg = (p, oy) =>
  `${((p.x - minX) * SCALE + 20).toFixed(1)},${((p.y - minY) * SCALE + oy).toFixed(1)}`;
const pathOf = (pts, oy, close) =>
  `M ${pts.map((p) => toSvg(p, oy)).join(" L ")}${close ? " Z" : ""}`;

const COLORS = {
  tplSol: "#ebcb79",
  tplSousFace: "#8491a7",
  tplTremie: "#4fe3d7",
  tplVoile: "#8491a7",
  tplCvgParoi: "#70aac6",
  tplCvgSousFace: "#e85426",
};

let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW.toFixed(0)}" height="${svgH.toFixed(0)}" viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" font-family="Helvetica, Arial, sans-serif" font-size="12">\n`;
out += `<rect width="100%" height="100%" fill="#ffffff"/>\n`;
panels.forEach((panel, i) => {
  const oy = 20 + i * (PH + PANEL_GAP) + 24;
  out += `<text x="20" y="${oy - 8}" font-weight="bold">${panel.title}</text>\n`;
  // GO context in grey on the cuvelage panels
  const context = panel.kind === "cvg" ? goRows : [];
  for (const a of context) {
    if (a.type === "STRIP") {
      for (const poly of getStripePolygons(a, meterByPx)) {
        out += `<path d="${pathOf(poly.points, oy, true)}" fill="#dddddd" stroke="#bbbbbb" stroke-width="1"/>\n`;
      }
    } else {
      out += `<path d="${pathOf(a.points, oy, true)}" fill="none" stroke="#cccccc" stroke-width="1" stroke-dasharray="4 3"/>\n`;
    }
  }
  const rows = [...panel.rows].sort(
    (a, b) => (a.type === "STRIP" ? 1 : 0) - (b.type === "STRIP" ? 1 : 0)
  );
  for (const a of rows) {
    const color = COLORS[a.annotationTemplateId] ?? "#000";
    if (a.type === "STRIP") {
      for (const poly of getStripePolygons(a, meterByPx)) {
        out += `<path d="${pathOf(poly.points, oy, true)}" fill="${color}" fill-opacity="0.64" stroke="${color}" stroke-width="1"/>\n`;
      }
    } else if (a.type === "POLYGON") {
      const hatch = a.annotationTemplateId !== "tplSol";
      out += `<path d="${pathOf(a.points, oy, true)}" fill="${color}" fill-opacity="${hatch ? 0.25 : 0.6}" stroke="${color}" stroke-width="1.5"${hatch ? ' stroke-dasharray="6 3"' : ""}/>\n`;
    } else {
      const label = `h ${a.height.toFixed(2)} m${a.offsetZ ? ` @ ${a.offsetZ.toFixed(2)} m` : ""}`;
      out += `<path d="${pathOf(a.points, oy, !!a.closeLine)}" fill="none" stroke="${color}" stroke-width="3"/>\n`;
      const p = a.points[Math.floor(a.points.length / 2)];
      out += `<text x="${((p.x - minX) * SCALE + 24).toFixed(1)}" y="${((p.y - minY) * SCALE + oy - 6).toFixed(1)}" fill="${color}">${label}</text>\n`;
    }
  }
  if (panel.kind === "cvg" && panel.rows.length === 0) {
    out += `<text x="40" y="${oy + 40}" fill="#999">(aucune annotation)</text>\n`;
  }
});
out += `</svg>\n`;
fs.writeFileSync(path.join(DIR, "expected-render.svg"), out);
console.log(`written ${path.join(DIR, "expected-render.svg")}`);
