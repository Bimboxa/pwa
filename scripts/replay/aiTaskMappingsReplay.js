// Run: node scripts/replay/aiTaskMappingsReplay.js
import assert from "node:assert/strict";
import {
  suggestAiTaskMappings,
  toAiTaskContract,
} from "../../src/Features/aiTasks/utils/aiTaskMappings.js";
import {
  requestAiTaskExample,
  completeAiTaskExample,
  cancelAiTaskExample,
} from "../../src/Features/aiTasks/services/aiTaskExampleCapture.js";

const row = {
  id: "walls",
  detectionLabel: "Murs extérieurs",
  label: "Concrete",
  type: "STRIP",
  description: "Facade walls",
  templateId: "",
};
const template = {
  id: "real",
  listingId: "target",
  label: "Murs exterieurs",
  type: "STRIP",
  strokeColor: "#abcdef",
};
assert.equal(
  suggestAiTaskMappings([row], [template], "target")[0].templateId,
  "real"
);
assert.equal(
  suggestAiTaskMappings(
    [row],
    [template, { ...template, id: "duplicate" }],
    "target"
  )[0].templateId,
  ""
);
assert.equal(
  suggestAiTaskMappings([row], [template], "other")[0].templateId,
  ""
);
assert.equal(
  suggestAiTaskMappings([row], [{ ...template, type: "POLYLINE" }], "target")[0]
    .templateId,
  ""
);
const example = {
  type: "STRIP",
  closeLine: false,
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.2 },
  ],
};
const contract = toAiTaskContract(
  { ...row, example, preview: "data:image/png;fake" },
  template
);
assert.deepEqual(contract.example, example);
assert.ok(!JSON.stringify(contract).includes("data:image"));
assert.equal(contract.detectionLabel, row.detectionLabel);
assert.equal(contract.label, template.label);
let received = null,
  error = null;
requestAiTaskExample("capture", "map", (value, message) => {
  received = value;
  error = message;
});
completeAiTaskExample({
  id: "capture",
  baseMapId: "map",
  points: [
    { x: 10, y: 20 },
    { x: 80, y: 20 },
  ],
  size: { width: 100, height: 100 },
  type: "STRIP",
  closeLine: false,
});
assert.deepEqual(received, example);
assert.equal(error, undefined);
received = null;
requestAiTaskExample("cancelled", "map", (value) => {
  received = value;
});
cancelAiTaskExample("cancelled");
completeAiTaskExample({
  id: "cancelled",
  baseMapId: "map",
  points: [],
  size: { width: 100, height: 100 },
});
assert.equal(received, null);
requestAiTaskExample("wrong-map", "map", (value, message) => {
  received = value;
  error = message;
});
completeAiTaskExample({
  id: "wrong-map",
  baseMapId: "other",
  points: [
    { x: 10, y: 20 },
    { x: 80, y: 20 },
  ],
  size: { width: 100, height: 100 },
});
assert.equal(received, null);
assert.ok(error);
console.log(
  "AI task mapping replay passed: suggestions, PDF-only transport, capture and cancellation."
);
