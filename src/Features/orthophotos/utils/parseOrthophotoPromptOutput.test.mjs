// Run with: npx vite-node src/Features/orthophotos/utils/parseOrthophotoPromptOutput.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import parseOrthophotoPromptOutput from "./parseOrthophotoPromptOutput.js";

const corners = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.12 },
  { x: 0.48, y: 0.6 },
  { x: 0.08, y: 0.55 },
];
const imagePaths = [
  "orthophotos/mosaique.png",
  "orthophotos/unitaires/P01.png",
  "orthophotos/unitaires/P02.png",
];
const knownNames = ["P01", "P02", "P03"];

const sample = () => ({
  version: "1.0",
  note: " Échelle non déterminée. ",
  orthophoto: {
    file: "orthophotos/mosaique.png",
    meterByPx: null,
    photos: [
      {
        name: "P01",
        ortho: "orthophotos/unitaires/P01.png",
        station: { x: 0.3, y: 0.35 },
        corners,
      },
      { name: "p02", ortho: "P02.png", corners },
    ],
  },
});

test("keeps the photos designated by a known name", () => {
  const result = parseOrthophotoPromptOutput(sample(), {
    imagePaths,
    knownNames,
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.file, "orthophotos/mosaique.png");
  assert.equal(result.data.meterByPx, null);
  assert.equal(result.data.note, "Échelle non déterminée.");
  assert.deepEqual(
    result.data.photos.map((p) => [p.name, p.orthoFile]),
    [
      ["P01", "orthophotos/unitaires/P01.png"],
      // name matched whatever its case
      ["P02", "orthophotos/unitaires/P02.png"],
    ]
  );
  assert.deepEqual(result.data.photos[0].station, { x: 0.3, y: 0.35 });
  assert.deepEqual(result.summary, { photos: 2, missing: ["P03"] });
});

test("drops unknown and duplicated photos with a warning", () => {
  const json = sample();
  json.orthophoto.photos.push(
    { name: "P09", ortho: "orthophotos/unitaires/P01.png", corners },
    { name: "P01", ortho: "orthophotos/unitaires/P02.png", corners }
  );
  const result = parseOrthophotoPromptOutput(json, { imagePaths, knownNames });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.photos.length, 2);
  const warnings = result.data.warnings.join("\n");
  assert.match(warnings, /P09.*aucune photo de ce nom/);
  assert.match(warnings, /P01.*en double/);
});

test("rejects a json without a usable mosaic", () => {
  const options = { imagePaths, knownNames };
  assert.match(parseOrthophotoPromptOutput(null, options).error, /objet/);
  assert.match(parseOrthophotoPromptOutput({}, options).error, /orthophoto/);
  const json = sample();
  json.orthophoto.file = "missing.png";
  assert.match(
    parseOrthophotoPromptOutput(json, options).error,
    /^orthophoto\.file introuvable/
  );
  json.orthophoto.file = "mosaique.png";
  json.orthophoto.meterByPx = 0;
  assert.match(parseOrthophotoPromptOutput(json, options).error, /meterByPx/);
});
