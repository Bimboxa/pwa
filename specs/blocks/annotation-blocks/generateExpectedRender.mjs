// Generates expected-render.svg from example-block.json with the REAL utils
// of Features/blocks (no bundling needed: they are import-free ES modules).
//
//   node specs/blocks/annotation-blocks/generateExpectedRender.mjs
//
// The SVG uses the same mechanism as the 2D editor: the block is drawn ONCE
// in <defs> (block frame, meters), each instance is a single <use>.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import getBlockBoundsM from "../../../src/Features/blocks/utils/getBlockBoundsM.js";
import {
  getBlockDefinitionTransform,
  getBlockInstanceAnchorPx,
  getBlockInstanceBoundsPx,
  getBlockInstanceTransform,
} from "../../../src/Features/blocks/utils/blockInstanceGeometry.js";
import { getBlockDefId } from "../../../src/Features/blocks/js/blockDefinitionsStore.js";

const here = dirname(fileURLToPath(import.meta.url));
const example = JSON.parse(
  readFileSync(join(here, "example-block.json"), "utf8")
);

const { blocksBaseMap, block, members, hostBaseMaps } = example;

// --- definition (what useBlockDefinitions computes) ---

const originPx = {
  x: block.origin.x * blocksBaseMap.imageSize.width,
  y: block.origin.y * blocksBaseMap.imageSize.height,
};
const meterByPx = blocksBaseMap.meterByPx;
const boundsM = getBlockBoundsM({ members, originPx, meterByPx });
const defId = getBlockDefId(block.id);

const memberSvg = (m) => {
  const pts = m.points.map((p) => `${p.x},${p.y}`).join(" ");
  return m.type === "POLYGON"
    ? `<polygon points="${pts}" fill="${m.fillColor}" fill-opacity="0.25" stroke="${m.strokeColor}" stroke-width="2" vector-effect="non-scaling-stroke"/>`
    : `<polyline points="${pts}" fill="none" stroke="${m.strokeColor}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
};

// --- layout: the blocks base map excerpt on the left, the hosts on the right ---

const PAD = 20;
const HOST_W = 600;
const HOST_H = 360;
const DEF_W = 300;
const totalW = PAD + DEF_W + PAD + HOST_W + PAD;
const totalH = PAD + hostBaseMaps.length * (HOST_H + PAD + 20);

const round = (n) => Math.round(n * 100) / 100;
const parts = [];
parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" font-family="sans-serif" font-size="13">`,
  `<rect width="${totalW}" height="${totalH}" fill="#f6f8fa"/>`,
  `<defs><g id="${defId}" transform="${getBlockDefinitionTransform({ originPx, meterByPx })}">${members.map(memberSvg).join("")}</g></defs>`
);

// left: the definition, drawn through the same <use>, at 1:50 on screen
const defScale = 0.02; // m per screen px
const defAnchor = { x: PAD + 110, y: PAD + 130 };
parts.push(
  `<text x="${PAD}" y="${PAD + 12}" font-weight="bold">Fond de plan de blocs — « ${block.label} »</text>`,
  `<rect x="${PAD}" y="${PAD + 24}" width="${DEF_W}" height="220" fill="#fff" stroke="#aebccb"/>`,
  `<use href="#${defId}" transform="${getBlockInstanceTransform({ anchorPx: defAnchor, rotationDeg: 0, hostMeterByPx: defScale })}"/>`,
  `<path d="M${defAnchor.x - 7} ${defAnchor.y} h14 M${defAnchor.x} ${defAnchor.y - 7} v14" stroke="#d1242f" stroke-width="1.5"/>`,
  `<text x="${defAnchor.x + 10} " y="${defAnchor.y - 8}" fill="#d1242f">origine</text>`,
  `<text x="${PAD}" y="${PAD + 262}" fill="#57606a">emprise : ${round(boundsM.maxX - boundsM.minX)} m × ${round(boundsM.maxY - boundsM.minY)} m</text>`
);

// right: the instances on each host base map
hostBaseMaps.forEach((host, index) => {
  const ox = PAD + DEF_W + PAD;
  const oy = PAD + index * (HOST_H + PAD + 20) + 20;
  parts.push(
    `<text x="${ox}" y="${oy - 6}" font-weight="bold">${host.name} — ${host.instances.length} instances</text>`,
    `<g transform="translate(${ox} ${oy})">`,
    `<rect width="${HOST_W}" height="${HOST_H}" fill="#fff" stroke="#aebccb"/>`
  );
  host.instances.forEach((stored) => {
    // what useAnnotationsV2 resolves: bbox in pixels
    const instance = {
      ...stored,
      bbox: {
        x: stored.bbox.x * host.imageSize.width,
        y: stored.bbox.y * host.imageSize.height,
        width: 0,
        height: 0,
      },
    };
    const anchorPx = getBlockInstanceAnchorPx(instance);
    const args = {
      anchorPx,
      rotationDeg: instance.rotation,
      hostMeterByPx: host.meterByPx,
    };
    const aabb = getBlockInstanceBoundsPx({ boundsM, ...args });
    parts.push(
      `<use href="#${defId}" transform="${getBlockInstanceTransform(args)}"/>`,
      `<rect x="${round(aabb.x)}" y="${round(aabb.y)}" width="${round(aabb.width)}" height="${round(aabb.height)}" fill="none" stroke="#8c959f" stroke-dasharray="4 3"/>`,
      `<path d="M${anchorPx.x - 5} ${anchorPx.y} h10 M${anchorPx.x} ${anchorPx.y - 5} v10" stroke="#d1242f" stroke-width="1.5"/>`,
      `<text x="${round(aabb.x)}" y="${round(aabb.y) - 4}" fill="#57606a">${instance.id} · ${instance.rotation}°</text>`
    );
  });
  parts.push(`</g>`);
});

parts.push(`</svg>`);
writeFileSync(join(here, "expected-render.svg"), parts.join("\n") + "\n");
console.log("expected-render.svg written", { boundsM });
