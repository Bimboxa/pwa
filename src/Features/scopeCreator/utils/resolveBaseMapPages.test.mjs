// Run: node --test src/Features/scopeCreator/utils/resolveBaseMapPages.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import resolveBaseMapPages from "./resolveBaseMapPages.js";

const listingConfigs = [
  {
    name: "Plans piscine",
    items: [{ type: "BLANK_PAGE", name: "Vue de dessus" }],
  },
];
const existingListings = [
  { id: "l1", name: "Plans piscine" },
  { id: "l2", name: "Fonds de plan" },
];

test("default: a project listing with the same name is reused", () => {
  const { folders, pages } = resolveBaseMapPages({
    listingConfigs,
    existingListings,
  });
  const declared = folders.find((f) => f.declared);
  assert.equal(declared.kind, "existing");
  assert.equal(declared.existing.id, "l1");
  assert.equal(pages[0].targetKey, "existing:l1");
});

test("disableExistingListings: the declared listing is created anyway", () => {
  const { folders, pages } = resolveBaseMapPages({
    listingConfigs,
    existingListings,
    hiddenExistingListingIds: ["l1", "l2"],
    disableExistingListings: true,
  });
  assert.equal(folders.length, 1);
  assert.equal(folders[0].kind, "new");
  assert.equal(folders[0].name, "Plans piscine");
  assert.equal(folders[0].listingConfig.forceNew, true);
  assert.equal(pages[0].targetKey, "new:Plans piscine");
});

test("disableExistingListings: a shown project listing stays its own folder", () => {
  const { folders } = resolveBaseMapPages({
    listingConfigs,
    existingListings,
    hiddenExistingListingIds: ["l2"],
    disableExistingListings: true,
  });
  assert.deepEqual(
    folders.map((f) => f.targetKey),
    ["new:Plans piscine", "existing:l1"]
  );
});
