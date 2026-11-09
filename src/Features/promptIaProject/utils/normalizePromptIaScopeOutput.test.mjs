import { test } from "node:test";
import assert from "node:assert/strict";

import normalizePromptIaScopeOutput from "./normalizePromptIaScopeOutput.js";

const TARGET = { scopeId: "krto_1", scopeName: "Mon Krto" };

function scope(id, name, listingNames, extra = {}) {
  return {
    id,
    name,
    listings: listingNames.map((n) => ({
      id: `${id}_${n}`,
      name: n,
      annotationTemplates: [],
      annotations: [],
    })),
    businessObjectListings: [],
    issues: [],
    ...extra,
  };
}

test("one scope: id and name become the Krto's, listings untouched", () => {
  const data = { scopes: [scope("s1", "Lot GO", ["Murs", "Poteaux"])] };
  const { scope: out, warnings } = normalizePromptIaScopeOutput(data, TARGET);
  assert.equal(out.id, "krto_1");
  assert.equal(out.name, "Mon Krto");
  assert.deepEqual(
    out.listings.map((l) => l.name),
    ["Murs", "Poteaux"]
  );
  assert.equal(out.listings[0], data.scopes[0].listings[0]);
  assert.deepEqual(warnings, []);
});

test("several scopes are merged in order, duplicate names suffixed", () => {
  const data = {
    scopes: [
      scope("s1", "GO", ["Murs", "Divers"], {
        businessObjectListings: [{ name: "DPGF GO" }],
        issues: [{ label: "i1" }],
      }),
      scope("s2", "Étanchéité", ["Toiture", "Divers"], {
        issues: [{ label: "i2" }],
      }),
    ],
  };
  const { scope: out, warnings } = normalizePromptIaScopeOutput(data, TARGET);
  assert.equal(out.id, "krto_1");
  assert.deepEqual(
    out.listings.map((l) => l.name),
    ["Murs", "Divers", "Toiture", "Divers (2)"]
  );
  assert.deepEqual(
    out.businessObjectListings.map((l) => l.name),
    ["DPGF GO"]
  );
  assert.deepEqual(
    out.issues.map((i) => i.label),
    ["i1", "i2"]
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2 scopes/);
  // input not mutated
  assert.equal(data.scopes[1].listings[1].name, "Divers");
});

test("no scope: empty scope with a warning", () => {
  const { scope: out, warnings } = normalizePromptIaScopeOutput(
    { scopes: [] },
    TARGET
  );
  assert.deepEqual(out, {
    id: "krto_1",
    name: "Mon Krto",
    listings: [],
    businessObjectListings: [],
    issues: [],
  });
  assert.equal(warnings.length, 1);
});
