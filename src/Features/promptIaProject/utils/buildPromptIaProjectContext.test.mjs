import { test } from "node:test";
import assert from "node:assert/strict";

import buildPromptIaProjectContext from "./buildPromptIaProjectContext.js";

const FILES = [{ path: "donnees/plan.pdf", mime: "application/pdf" }];

test("project context: historical keys, kind PROJECT", () => {
  const context = buildPromptIaProjectContext({
    project: { name: " Résidence ", clientRef: "P-1" },
    description: "  deux scopes ",
    files: FILES,
  });
  assert.equal(context.kind, "PROJECT");
  assert.deepEqual(context.project, { name: "Résidence", clientRef: "P-1" });
  assert.equal(context.scopesDescription, "deux scopes");
  assert.equal("scope" in context, false);
  assert.equal("scopesCount" in context.output, false);
  assert.deepEqual(context.output.scopeKeys, [
    "id",
    "name",
    "listings",
    "businessObjectListings",
    "issues",
  ]);
  assert.equal(context.files, FILES);
});

test("scope context: kind SCOPE, scope name, one scope expected", () => {
  const context = buildPromptIaProjectContext({
    project: { name: "Résidence" },
    description: "murs du RDC",
    files: [],
    scope: { name: " Gros œuvre " },
  });
  assert.equal(context.kind, "SCOPE");
  assert.deepEqual(context.scope, { name: "Gros œuvre" });
  assert.equal(context.output.scopesCount, 1);
  assert.equal(context.project.clientRef, null);
});
