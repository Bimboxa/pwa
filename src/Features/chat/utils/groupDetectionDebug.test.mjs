import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupDetectionDebug,
  serializeDetectionDebug,
} from "./groupDetectionDebug.js";
const row = (id, stage, time, messageId = "turn") => ({
  id,
  archiveKey: "scope",
  messageId,
  listingId: "list",
  createdAt: time,
  artifact: { id, stage, data: { argumentsJson: '{"unfinished' } },
});
test("merges all stages into one chronological export without altering raw strings", () => {
  const input = [
    row("python2", "pdf_inspection", 20),
    row("draw", "raw_detection", 30),
    row("python1", "pdf_inspection", 10),
    row("converted", "converted_detection", 40),
  ];
  const before = JSON.stringify(input);
  const groups = groupDetectionDebug(input);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].artifacts.map((a) => a.id),
    ["python1", "python2", "draw", "converted"]
  );
  assert.equal(
    JSON.parse(serializeDetectionDebug(groups[0])).artifacts[2].data
      .argumentsJson,
    '{"unfinished'
  );
  assert.equal(JSON.stringify(input), before);
});
test("stable bundle id, duplicate replacement, legacy compatibility and scope isolation", () => {
  const one = groupDetectionDebug([row("a", "pdf_inspection", 10)])[0];
  const two = groupDetectionDebug([
    one,
    row("b", "pdf_inspection", 20),
    row("a", "pdf_inspection", 15),
  ])[0];
  assert.equal(two.id, one.id);
  assert.equal(two.artifacts.length, 2);
  assert.equal(two.artifacts[0].createdAt, 15);
  assert.equal(
    groupDetectionDebug([two, row("c", "raw_detection", 30, "other")]).length,
    2
  );
  assert.equal(
    groupDetectionDebug([
      two,
      { ...row("d", "pdf_inspection", 40), archiveKey: "other-user" },
    ]).length,
    2
  );
  assert.equal(
    groupDetectionDebug([{ ...two, status: "interrupted" }])[0].status,
    "interrupted"
  );
});
