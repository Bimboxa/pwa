import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractJsonText,
  normalizePromptIaPayload,
} from "./parsePromptIaOutput.js";

const payload = {
  version: "1.0",
  coordinateSpace: "image",
  note: "page 1",
  image: { width: 100, height: 50 },
  annotationTemplates: [
    { id: "existing-1", label: "Mur", type: "POLYLINE" },
    { id: "tpl_new", label: "Poteau", type: "POLYGON", incomplete: true },
  ],
  annotations: [
    { id: "a", type: "POLYLINE", annotationTemplateId: "existing-1", points: [] },
    { id: "b", type: "POLYGON", annotationTemplateId: "tpl_new", points: [] },
  ],
};

test("extractJsonText reads a one-line JSON inside a fenced block with prose around", () => {
  const text = `Voici le résultat :\n\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`\nBonne journée { pas du json }`;
  const r = extractJsonText(text);
  assert.equal(r.ok, true);
  assert.equal(r.json.annotations.length, 2);
});

test("extractJsonText accepts raw JSON and reports truncation", () => {
  assert.equal(extractJsonText(JSON.stringify(payload)).ok, true);
  const cut = JSON.stringify(payload).slice(0, 40);
  const r = extractJsonText(cut);
  assert.equal(r.ok, false);
  assert.match(r.error, /incomplet/);
  assert.equal(extractJsonText("   ").error, null);
  assert.match(extractJsonText("rien ici").error, /Aucun objet/);
});

test("extractJsonText is not fooled by braces inside strings", () => {
  const r = extractJsonText('{"a":"}","b":1}');
  assert.equal(r.ok, true);
  assert.equal(r.json.b, 1);
});

test("normalizePromptIaPayload keeps existing template ids, remints the others and strips root extras", () => {
  let n = 0;
  const r = normalizePromptIaPayload(payload, {
    existingTemplateIds: ["existing-1"],
    newId: () => `nano${++n}`,
  });
  assert.equal(r.error, undefined);
  assert.equal(r.coordinateSpace, "image");
  assert.equal(r.note, "page 1");
  assert.deepEqual(r.reusedTemplateIds, ["existing-1"]);
  assert.equal(r.payload.coordinateSpace, undefined);
  assert.equal(r.payload.note, undefined);
  assert.equal(r.payload.annotationTemplates[0].id, "existing-1");
  assert.equal(r.payload.annotationTemplates[1].id, "nano1");
  assert.equal(r.payload.annotationTemplates[1].incomplete, undefined);
  assert.equal(r.payload.annotations[0].annotationTemplateId, "existing-1");
  assert.equal(r.payload.annotations[1].annotationTemplateId, "nano1");
});

test("normalizePromptIaPayload defaults to the image space and rejects unknown spaces", () => {
  const { coordinateSpace: _, ...noSpace } = payload;
  void _;
  assert.equal(
    normalizePromptIaPayload(noSpace, { existingTemplateIds: [], newId: () => "x" })
      .coordinateSpace,
    "image"
  );
  const bad = normalizePromptIaPayload(
    { ...payload, coordinateSpace: "meters" },
    { existingTemplateIds: [], newId: () => "x" }
  );
  assert.match(bad.error, /coordinateSpace inconnu/);
});
