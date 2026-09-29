import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTurnAttachments, readyAttachments } from "./chatAttachments.js";

const attachments = [
  { id: "r1", name: "carnet.pdf", status: "ready", pdfId: "pdf-1" },
  { id: "r2", name: "notice.pdf", status: "uploading", pdfId: null },
  { id: "r3", name: "cassé.pdf", status: "error", pdfId: null },
  { id: "r4", name: "cctp.pdf", status: "ready", pdfId: "pdf-4" },
];

test("only uploaded attachments are sent", () => {
  assert.deepEqual(
    readyAttachments(attachments).map((a) => a.id),
    ["r1", "r4"]
  );
  assert.deepEqual(readyAttachments(undefined), []);
});

test("a turn carries the attachments and what the conversation already received", () => {
  assert.deepEqual(buildTurnAttachments(attachments, ["pdf-1", "pdf-gone"]), {
    attachments: [
      { pdfId: "pdf-1", name: "carnet.pdf" },
      { pdfId: "pdf-4", name: "cctp.pdf" },
    ],
    // A removed attachment is no longer announced.
    attachmentsInConversation: ["pdf-1"],
  });
  assert.deepEqual(buildTurnAttachments(attachments, []), {
    attachments: [
      { pdfId: "pdf-1", name: "carnet.pdf" },
      { pdfId: "pdf-4", name: "cctp.pdf" },
    ],
  });
});

test("a conversation without attachment adds nothing to the request", () => {
  assert.deepEqual(buildTurnAttachments([], ["pdf-1"]), {});
  assert.deepEqual(buildTurnAttachments([attachments[1]], []), {});
});
