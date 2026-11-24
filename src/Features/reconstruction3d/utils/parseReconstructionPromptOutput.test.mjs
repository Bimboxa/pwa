// Run with: npx vite-node src/Features/reconstruction3d/utils/parseReconstructionPromptOutput.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import parseReconstructionPromptOutput from "./parseReconstructionPromptOutput.js";

const modelPaths = ["reconstruction/modele.glb"];
const knownNames = ["F001", "F002", "F003"];

const sample = () => ({
  version: "1.0",
  note: " SfM + Poisson ",
  reconstruction: {
    file: "reconstruction/modele.glb",
    scaleIsMetric: false,
    frames: [
      { name: "F001", position: [0, 1.6, 0], forward: [0, 0, -2] },
      {
        name: "f002.jpg",
        position: [1, 1.6, 0],
        forward: [1, 0, 0],
        hfovDeg: 68,
      },
    ],
  },
});

const parse = (json, options = {}) =>
  parseReconstructionPromptOutput(json, { modelPaths, knownNames, ...options });

test("valid output", () => {
  const result = parse(sample());
  assert.equal(result.ok, true);
  assert.equal(result.data.file, "reconstruction/modele.glb");
  assert.equal(result.data.scaleIsMetric, false);
  assert.equal(result.data.note, "SfM + Poisson");
  assert.deepEqual(
    result.data.frames.map((f) => f.name),
    ["F001", "F002"]
  );
  assert.deepEqual(result.summary, { frames: 2, missing: ["F003"] });
});

test("forward is normalized, names match without case nor extension", () => {
  const [first, second] = parse(sample()).data.frames;
  assert.deepEqual(first.forward, [0, 0, -1]);
  assert.equal(first.hfovDeg, null);
  assert.equal(second.hfovDeg, 68);
});

test("target stands for forward", () => {
  const json = sample();
  json.reconstruction.frames = [
    { name: "F003", position: [0, 0, 0], target: [0, 0, 5] },
  ];
  assert.deepEqual(parse(json).data.frames[0].forward, [0, 0, 1]);
});

test("invalid, unknown and duplicate cameras are left out with a warning", () => {
  const json = sample();
  json.reconstruction.frames.push(
    { name: "F001", position: [9, 9, 9], forward: [0, 1, 0] },
    { name: "F003", position: [0, "x", 0], forward: [0, 1, 0] },
    { name: "F003", position: [0, 0, 0], forward: [0, 0, 0] },
    { name: "F999", position: [0, 0, 0], forward: [0, 1, 0] }
  );
  const result = parse(json);
  assert.equal(result.data.frames.length, 2);
  assert.deepEqual(result.data.frames[0].position, [0, 1.6, 0]);
  assert.equal(result.data.warnings.length, 3);
});

test("the only GLB of the zip is taken when the path does not match", () => {
  const result = parse(sample(), { modelPaths: ["out/model.glb"] });
  assert.equal(result.data.file, "out/model.glb");
});

test("no model: error", () => {
  assert.equal(parse(sample(), { modelPaths: [] }).ok, false);
  assert.equal(parse({}).ok, false);
  assert.equal(parse(null).ok, false);
});

test("a result without frames still loads the model", () => {
  const json = sample();
  delete json.reconstruction.frames;
  const result = parse(json);
  assert.equal(result.ok, true);
  assert.equal(result.data.frames.length, 0);
  assert.equal(result.data.warnings.length, 1);
});

test("a default fov applies to the frames without one", () => {
  const json = sample();
  json.reconstruction.hfovDeg = 60;
  const frames = parse(json).data.frames;
  assert.equal(frames[0].hfovDeg, 60);
  assert.equal(frames[1].hfovDeg, 68);
});
