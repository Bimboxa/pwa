import assert from "node:assert/strict";
import { test } from "node:test";
import { chatPlanSource } from "./chatPlanSource.js";

test("PDF chat metadata needs neither local bytes nor an existing relay upload", () => {
  const result = chatPlanSource({
    id: "plan",
    createdFrom: {
      type: "PDF_PAGE",
      resourceId: "resource",
      pageNumber: 2,
      rotation: 90,
    },
    image: { imageSize: { width: 600, height: 400 } },
  });
  assert.equal(result.planKind, "pdf");
  assert.equal(result.sourceFrame.pageNumber, 2);
  assert.equal(result.sourceFrame.rotation, 90);
  assert.deepEqual(result.planPdf.sourceImageSize, { width: 600, height: 400 });
  assert.equal(result.planPdf.base64, undefined);
});

test("unavailable PDF stays identifiable without blocking a context-only request", () => {
  assert.deepEqual(
    chatPlanSource({ id: "plan", createdFrom: { type: "PDF_PAGE" } }),
    { planKind: "pdf" }
  );
});

test("image base maps retain the image request path", () => {
  assert.deepEqual(chatPlanSource({ id: "image" }), { planKind: "image" });
});
