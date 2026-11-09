import { test } from "node:test";
import assert from "node:assert/strict";

import {
  countPromptIaImportTasks,
  createImportCounts,
  hasBusinessData,
} from "./promptIaImportTasks.js";

test("countPromptIaImportTasks counts every visible step", () => {
  const data = {
    site: { reference: { type: "SATELLITE" } },
    baseMaps: [
      { id: "a", placement: { points: [] } },
      { id: "b" },
      { id: "c", placement: { points: [] } },
    ],
    documents: [{ id: "d1" }],
    scopes: [
      {
        listings: [
          {
            annotations: [
              { baseMapId: "a" },
              { baseMapId: "a" },
              { baseMapId: "b" },
            ],
          },
          { annotations: [{ baseMapId: "c" }] },
        ],
        issues: [{ label: "x" }],
      },
      { listings: [] },
    ],
  };
  // satellite 1 + base maps 3 + placements 2 + documents 1 + scopes 2
  // + business data 1 + imports (2 + 1)
  assert.equal(countPromptIaImportTasks(data), 13);
});

test("hasBusinessData and createImportCounts", () => {
  assert.equal(hasBusinessData({ issues: [{}] }), true);
  assert.equal(hasBusinessData({ businessObjectListings: [] }), false);
  assert.equal(hasBusinessData(null), false);
  const counts = createImportCounts();
  assert.equal(
    Object.values(counts).every((v) => v === 0),
    true
  );
  assert.ok("qtyGapIssues" in counts);
});
